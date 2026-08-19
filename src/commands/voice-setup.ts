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
  addHub,
  getHubInCategory,
  getHubsForGuild,
  removeAllHubs,
  removeHubInCategory,
} from '../models/VoiceHub';

export const data = new SlashCommandBuilder()
  .setName('voice-setup')
  .setDescription('Configure the bot on this server')
  // No setDefaultMemberPermissions here on purpose: it is checked in code by
  // canConfigureBot so that the maintainer keeps their bypass
  .addSubcommand((sub) =>
    sub
      .setName('auto')
      .setDescription(
        'Create a new sector, category and trigger channel included',
      )
      .addStringOption((option) =>
        option
          .setName('name')
          .setDescription('Name of the category to create')
          .setMaxLength(100),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription(
        'Turn an existing category and voice channel into a sector',
      )
      .addChannelOption((option) =>
        option
          .setName('category')
          .setDescription('The category I will manage channels in')
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(true),
      )
      .addChannelOption((option) =>
        option
          .setName('channel')
          .setDescription('Joining it will generate a new voice channel')
          .addChannelTypes(ChannelType.GuildVoice)
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('List the sectors I manage here'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Stop managing a sector')
      .addChannelOption((option) =>
        option
          .setName('category')
          .setDescription('The category to stop managing')
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('clear').setDescription('Forget every sector on this server'),
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
      case 'add':
        await addSector(interaction);
        break;
      case 'list':
        await listSectors(interaction);
        break;
      case 'remove':
        await removeSector(interaction);
        break;
      case 'clear':
        await clearSectors(interaction);
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
    name: interaction.options.getString('name') ?? 'Voice channels',
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

  addHub({
    guildId: interaction.guildId,
    categoryId: category.id,
    creatingChannelId: creatingChannel.id,
  });

  const warning = await pinOwnPermissions(interaction, category);

  await respond(interaction, {
    content: warning ?? undefined,
    embeds: [describeSector(interaction, category, creatingChannel)],
  });
}

async function addSector(interaction: ChatInputCommandInteraction<'cached'>) {
  const category = interaction.options.getChannel('category', true);
  const channel = interaction.options.getChannel('channel', true);

  // A trigger channel belongs to its own sector.
  if (channel.parentId !== category.id) {
    await respond(interaction, {
      content: `🛑 **${channel.name}** has to live inside **${category.name}** for me to use it as a trigger.`,
    });
    return;
  }

  // A sector is a category, so a category holds exactly one trigger
  const existing = getHubInCategory(interaction.guildId, category.id);

  // Re-declaring the exact same pair is legitimate, but saying "will now
  // generate" would suggest something changed when nothing did
  if (existing?.creatingChannelId === channel.id) {
    await respond(interaction, {
      content: `ℹ️ That's already how **${category.name}** works — ${channel} generates its channels. Nothing to change.`,
    });
    return;
  }

  if (existing) {
    const current = interaction.guild.channels.resolve(
      existing.creatingChannelId,
    );
    await respond(interaction, {
      content: `🛑 **${category.name}** already generates channels from ${
        current ?? 'a channel that has since been deleted'
      }. Run \`/voice-setup remove\` on it first, or pick another category.`,
    });
    return;
  }

  addHub({
    guildId: interaction.guildId,
    categoryId: category.id,
    creatingChannelId: channel.id,
  });

  await respond(interaction, {
    content: `✅ Joining ${channel} will now generate a new voice channel inside **${category.name}**.`,
  });
}

async function listSectors(interaction: ChatInputCommandInteraction<'cached'>) {
  const hubs = getHubsForGuild(interaction.guildId);

  if (!hubs.length) {
    await respond(interaction, {
      content: `I don't manage any sector on this server yet. Run \`/voice-setup auto\` and I'll create one.`,
    });
    return;
  }

  const lines = hubs.map((hub) => {
    const category = interaction.guild.channels.resolve(hub.categoryId);
    const creatingChannel = interaction.guild.channels.resolve(
      hub.creatingChannelId,
    );
    const categoryLabel = category
      ? `**${category.name}**`
      : '⚠️ deleted category';
    const channelLabel = creatingChannel
      ? `${creatingChannel}`
      : '⚠️ deleted channel';
    return `- ${categoryLabel} — triggered by ${channelLabel}`;
  });

  await respond(interaction, {
    embeds: [
      new EmbedBuilder()
        .setTitle(
          `${hubs.length} sector${hubs.length > 1 ? 's' : ''} on this server`,
        )
        .setDescription(lines.join('\n'))
        .setColor(6465260)
        .setTimestamp(new Date()),
    ],
  });
}

async function removeSector(
  interaction: ChatInputCommandInteraction<'cached'>,
) {
  const category = interaction.options.getChannel('category', true);
  const removed = removeHubInCategory(interaction.guildId, category.id);

  await respond(interaction, {
    content: removed
      ? `🧹 I no longer manage **${category.name}**. The channels already there are left untouched.`
      : `I wasn't managing **${category.name}** in the first place.`,
  });
}

async function clearSectors(
  interaction: ChatInputCommandInteraction<'cached'>,
) {
  const removed = removeAllHubs(interaction.guildId);

  await respond(interaction, {
    content: removed
      ? `🧹 Done, I forgot all ${removed} sector${removed > 1 ? 's' : ''} on this server. Run \`/voice-setup auto\` whenever you want to start over.`
      : `There was nothing to forget on this server.`,
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

function describeSector(
  interaction: ChatInputCommandInteraction<'cached'>,
  category: CategoryChannel,
  creatingChannel: VoiceChannel,
) {
  return new EmbedBuilder()
    .setTitle('Sector ready! 🎉')
    .setDescription(
      `Your members can now join ${creatingChannel} to get their own voice channel, which I'll delete once it's empty.\n\nRun \`/voice-setup auto\` again to add another sector, or \`/voice-setup list\` to see them all.`,
    )
    .addFields(
      { name: 'Category', value: `${category}` },
      { name: 'Channel that creates channels', value: `${creatingChannel}` },
    )
    .setColor(6465260)
    .setThumbnail(interaction.client.user.avatarURL())
    .setTimestamp(new Date());
}
