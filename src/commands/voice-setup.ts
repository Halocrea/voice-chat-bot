import {
  CategoryChannel,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  OverwriteResolvable,
  PermissionFlagsBits,
  SlashCommandBuilder,
  VoiceChannel,
} from 'discord.js';
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
  // Discord enforces this for us, and server admins can still hand the command
  // to specific roles from Server Settings > Integrations
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
  const permissionOverwrites: OverwriteResolvable[] = [
    {
      id: interaction.client.user.id,
      allow: [
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageRoles,
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.MoveMembers,
      ],
    },
  ];

  const category = await interaction.guild.channels.create({
    name: 'Voice channels',
    type: ChannelType.GuildCategory,
    permissionOverwrites,
  });
  const creatingChannel = await interaction.guild.channels.create({
    name: 'Create a channel',
    type: ChannelType.GuildVoice,
    parent: category.id,
    permissionOverwrites,
  });

  setGuildSetup({
    guildId: interaction.guildId,
    categoryId: category.id,
    creatingChannelId: creatingChannel.id,
  });

  await respond(interaction, {
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
