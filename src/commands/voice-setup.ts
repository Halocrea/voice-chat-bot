import {
  CategoryChannel,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  VoiceChannel,
} from 'discord.js';
import { canConfigureBot, missingBotPermissions } from '../lib/permissions';
import { respond, respondWithError } from '../lib/replies';
import {
  deleteGuildSetup,
  getGuildSetup,
  setCategoryId,
  setCreatingChannelId,
  setGuildSetup,
} from '../models/GuildSetup';

export const data = new SlashCommandBuilder()
  .setName('voice-setup')
  .setDescription('Configure the bot on this server')
  // No setDefaultMemberPermissions here on purpose: it is checked in code by
  // canConfigureBot so that the maintainer keeps their bypass
  .addSubcommand((sub) =>
    sub
      .setName('auto')
      .setDescription('Let me create the category and the channel I need'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('category')
      .setDescription('Tell me which category I should manage channels in')
      .addChannelOption((option) =>
        option
          .setName('category')
          .setDescription('The category I will work in')
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('voice')
      .setDescription('Tell me which voice channel creates new channels')
      .addChannelOption((option) =>
        option
          .setName('channel')
          .setDescription('Joining it will generate a new voice channel')
          .addChannelTypes(ChannelType.GuildVoice)
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('show').setDescription('Show my current configuration'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('clear')
      .setDescription('Forget everything I know about this server'),
  );

export async function execute(
  interaction: ChatInputCommandInteraction<'cached'>,
) {
  if (!canConfigureBot(interaction.member)) {
    await respond(interaction, {
      content:
        'You must be an administrator of this server to configure me. 🛑',
    });
    return;
  }

  try {
    switch (interaction.options.getSubcommand()) {
      case 'auto':
        await autoSetup(interaction);
        break;
      case 'category':
        await setCategory(interaction);
        break;
      case 'voice':
        await setCreatingChannel(interaction);
        break;
      case 'show':
        await showSetup(interaction);
        break;
      case 'clear':
        await clearSetup(interaction);
        break;
    }
  } catch (error) {
    await respondWithError(interaction, error);
  }
}

async function autoSetup(interaction: ChatInputCommandInteraction<'cached'>) {
  // Checked up front so a missing permission is named instead of surfacing as
  // an opaque "Missing Permissions" from the channel creation call
  const missing = missingBotPermissions(interaction.guild);
  if (missing.length) {
    await respond(interaction, {
      content: `🛑 I can't do this, I'm missing the following permissions on this server:\n${missing
        .map((permission) => `- **${permission}**`)
        .join(
          '\n',
        )}\n\nGrant them to my role in _Server Settings > Roles_, or re-invite me with the link from the README.`,
    });
    return;
  }

  // The channels are created bare, then the overwrites are applied separately.
  // Discord rejects a creation whose overwrites grant a permission the bot
  // can't hand out, and the refusal is a bare 403 naming nothing. Splitting the
  // two keeps the setup working even when pinning the permissions is refused.
  const category = await interaction.guild.channels.create({
    name: 'Voice channels',
    type: ChannelType.GuildCategory,
  });

  let creatingChannel: VoiceChannel;
  try {
    creatingChannel = await interaction.guild.channels.create({
      name: 'Create a channel',
      type: ChannelType.GuildVoice,
      parent: category.id,
    });
  } catch (error) {
    // Never leave a stray category behind on a half-finished setup
    await category.delete('Voice Bot: setup failed').catch(() => undefined);
    throw error;
  }

  setGuildSetup({
    guildId: interaction.guildId,
    categoryId: category.id,
    creatingChannelId: creatingChannel.id,
  });

  const warning = await pinOwnPermissions(interaction, category);

  await respond(interaction, {
    content: warning ?? undefined,
    embeds: [
      describeSetup(
        interaction,
        'All set! 🎉',
        category,
        creatingChannel,
        6465260,
      ),
    ],
  });
}

/**
 * Writes the bot's own permissions onto the category so a later change to the
 * server roles can't silently lock it out. Best effort: the bot already holds
 * these permissions guild-wide, so a refusal here is worth a warning, not a
 * failed setup.
 */
async function pinOwnPermissions(
  interaction: ChatInputCommandInteraction<'cached'>,
  category: CategoryChannel,
): Promise<string | null> {
  try {
    // Manage Permissions is deliberately absent. Discord refuses to let a
    // non-administrator bot grant *that* permission through an overwrite, even
    // when it already holds it server-wide: handing out the right to hand out
    // rights is the obvious escalation path, so it is guarded on purpose. The
    // server-wide grant is all the bot needs to edit the overwrites of the
    // channels it creates, so there is nothing to work around here.
    await category.permissionOverwrites.edit(
      interaction.client.user.id,
      {
        ManageChannels: true,
        ViewChannel: true,
        Connect: true,
        MoveMembers: true,
      },
      { reason: 'Voice Bot: keeping my own access to the category I manage' },
    );
    return null;
  } catch (error) {
    console.error('Could not pin my own permissions on the category:', error);
    return `⚠️ I couldn't pin my own permissions on the category, so make sure my role keeps them server-wide. Everything else is ready.`;
  }
}

async function setCategory(interaction: ChatInputCommandInteraction<'cached'>) {
  const category = interaction.options.getChannel('category', true);
  setCategoryId(interaction.guildId, category.id);
  await respond(interaction, {
    content: `✅ I will manage voice channels inside **${category.name}**.\nDon't forget \`/voice-setup voice\` if you haven't set it yet.`,
  });
}

async function setCreatingChannel(
  interaction: ChatInputCommandInteraction<'cached'>,
) {
  const channel = interaction.options.getChannel('channel', true);
  setCreatingChannelId(interaction.guildId, channel.id);
  await respond(interaction, {
    content: `✅ Joining **${channel.name}** will now generate a new voice channel.`,
  });
}

async function showSetup(interaction: ChatInputCommandInteraction<'cached'>) {
  const guildSetup = getGuildSetup(interaction.guildId);
  if (!guildSetup) {
    await respond(interaction, {
      content: `I'm not configured on this server yet. Run \`/voice-setup auto\` and I'll take care of everything.`,
    });
    return;
  }

  const category = guildSetup.categoryId
    ? interaction.guild.channels.resolve(guildSetup.categoryId)
    : null;
  const creatingChannel = guildSetup.creatingChannelId
    ? interaction.guild.channels.resolve(guildSetup.creatingChannelId)
    : null;

  await respond(interaction, {
    embeds: [
      new EmbedBuilder()
        .setTitle('My current configuration')
        .setColor(6465260)
        .addFields(
          {
            name: 'Category',
            value: category ? `${category}` : '❌ not set',
          },
          {
            name: 'Channel that creates channels',
            value: creatingChannel ? `${creatingChannel}` : '❌ not set',
          },
        )
        .setTimestamp(new Date()),
    ],
  });
}

async function clearSetup(interaction: ChatInputCommandInteraction<'cached'>) {
  deleteGuildSetup(interaction.guildId);
  await respond(interaction, {
    content: `🧹 Done, I forgot everything about this server. Run \`/voice-setup auto\` whenever you want to start over.`,
  });
}

function describeSetup(
  interaction: ChatInputCommandInteraction<'cached'>,
  title: string,
  category: CategoryChannel,
  creatingChannel: VoiceChannel,
  color: number,
) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(
      `Your members can now join ${creatingChannel} to get their own voice channel, which I'll delete once it's empty.\n\nUse \`/voice\` to see everything they can do with it.`,
    )
    .addFields(
      { name: 'Category', value: `${category}` },
      { name: 'Channel that creates channels', value: `${creatingChannel}` },
    )
    .setColor(color)
    .setThumbnail(interaction.client.user.avatarURL())
    .setTimestamp(new Date());
}
