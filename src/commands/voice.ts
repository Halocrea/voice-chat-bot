import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  GuildMember,
  GuildPremiumTier,
  MessageFlags,
  Role,
  SlashCommandBuilder,
  VoiceChannel,
} from 'discord.js';
import {
  canBypassOwnership,
  isProtectedFromRejection,
} from '../lib/permissions';
import { respond, respondWithError } from '../lib/replies';
import { setHistoricLimit, setHistoricName } from '../models/Historic';
import {
  addHistoricPermission,
  deleteAllHistoricPermissions,
  getAllHistoricPermissions,
} from '../models/HistoricPermission';
import { editOwnership, getOwner } from '../models/Ownership';

export const data = new SlashCommandBuilder()
  .setName('voice')
  .setDescription('Manage the voice channel you are in')
  .addSubcommand((sub) =>
    sub
      .setName('name')
      .setDescription('Rename your channel')
      .addStringOption((option) =>
        option
          .setName('name')
          .setDescription('The new channel name')
          .setRequired(true)
          .setMaxLength(100),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('lock')
      .setDescription(
        'Lock your channel so nobody can join without permission',
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('unlock').setDescription('Open your channel back to everyone'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('permit')
      .setDescription('Allow a member or a role to join your locked channel')
      .addMentionableOption((option) =>
        option
          .setName('target')
          .setDescription('The member or role to allow')
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('reject')
      .setDescription('Kick a member out of your channel')
      .addUserOption((option) =>
        option
          .setName('member')
          .setDescription('The member to kick out')
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('limit')
      .setDescription('Set how many people can join your channel')
      .addIntegerOption((option) =>
        option
          .setName('count')
          .setDescription('Between 0 and 99, where 0 means unlimited')
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(99),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('bitrate')
      .setDescription("Set your channel's bitrate")
      .addIntegerOption((option) =>
        option
          .setName('bitrate')
          .setDescription(
            'In bits per second; the maximum depends on the server boost level',
          )
          .setRequired(true)
          .setMinValue(8000),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('claim')
      .setDescription('Take ownership of this channel if its owner left'),
  );

export async function execute(
  interaction: ChatInputCommandInteraction<'cached'>,
) {
  const subcommand = interaction.options.getSubcommand();
  const member = interaction.member;
  const channel = member.voice.channel;

  if (!channel || channel.type !== ChannelType.GuildVoice) {
    await respond(interaction, {
      content:
        'You have to be in a voice channel to run this kind of commands.',
    });
    return;
  }

  // A channel with no ownership record is simply not one of ours. The previous
  // version destructured this straight away and threw on every other channel.
  const ownership = getOwner(channel.id);
  if (!ownership) {
    await respond(interaction, {
      content: "This isn't one of the channels I manage 🤔",
    });
    return;
  }

  try {
    if (subcommand === 'claim') {
      await claimChannel(interaction, channel, ownership.userId);
      return;
    }

    if (ownership.userId !== member.id && !canBypassOwnership(member)) {
      await respond(interaction, {
        content: `You do not own the channel you're trying to modify; if its owner left, you can claim it with \`/voice claim\`.`,
      });
      return;
    }

    switch (subcommand) {
      case 'name':
        await renameChannel(interaction, channel);
        break;
      case 'lock':
        await lockChannel(interaction, channel, ownership.userId);
        break;
      case 'unlock':
        await unlockChannel(interaction, channel);
        break;
      case 'permit':
        await permitTarget(interaction, channel);
        break;
      case 'reject':
        await rejectMember(interaction, channel);
        break;
      case 'limit':
        await setChannelLimit(interaction, channel);
        break;
      case 'bitrate':
        await setChannelBitrate(interaction, channel);
        break;
    }
  } catch (error) {
    await respondWithError(interaction, error);
  }
}

async function renameChannel(
  interaction: ChatInputCommandInteraction<'cached'>,
  channel: VoiceChannel,
) {
  const name = interaction.options.getString('name', true);
  const author = interaction.member.nickname ?? interaction.user.username;

  // Remembered per sector, so the same member can keep a different name in
  // each category. A channel outside any category has no sector to remember.
  if (channel.parentId) {
    setHistoricName(interaction.user.id, channel.parentId, name);
  }
  await channel.edit({
    name,
    reason: `Voice Bot: Asked by its owner (${author})`,
  });
  await respond(interaction, {
    content: `ℹ️ The channel has been renamed "**${name}**", ${author}!`,
  });
}

async function lockChannel(
  interaction: ChatInputCommandInteraction<'cached'>,
  channel: VoiceChannel,
  ownerId: string,
) {
  await channel.permissionOverwrites.edit(ownerId, { Connect: true });
  await channel.permissionOverwrites.edit(
    interaction.guild.id,
    { Connect: false },
    {
      reason: `Voice Bot: The owner (${interaction.user.username}) wants to lock the channel`,
    },
  );

  const historicPermissions = getAllHistoricPermissions(interaction.user.id);
  if (!historicPermissions.length) {
    await respond(interaction, { content: '🔒 The channel is now **locked**' });
    return;
  }

  const allowed = await describeAllowed(
    interaction,
    historicPermissions.map((permission) => permission.permittedUserId),
  );

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('restore')
      .setLabel('Restore them')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('discard')
      .setLabel('Start fresh')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Secondary),
  );

  // editReply, not reply: the router already acknowledged this interaction, and
  // the two permission edits above are exactly why it had to
  const response = await interaction.editReply({
    content: '🔒 The channel is now **locked**',
    embeds: [
      new EmbedBuilder()
        .setTitle(
          'Do you want me to set the permissions just like your previous voice channel?',
        )
        .setDescription(
          allowed
            ? `Those members/roles would be allowed to join you:\n\n${allowed}`
            : 'None of them are on this server anymore.',
        )
        .setColor(7944435)
        .setTimestamp(new Date()),
    ],
    components: [buttons],
  });

  try {
    const choice = await response.awaitMessageComponent({
      componentType: ComponentType.Button,
      time: 2 * 60000,
    });

    if (choice.customId === 'restore') {
      for (const permission of historicPermissions) {
        await channel.permissionOverwrites.edit(permission.permittedUserId, {
          Connect: true,
        });
      }
      await choice.update({
        content: '✅ Last permissions **loaded**',
        embeds: [],
        components: [],
      });
    } else {
      deleteAllHistoricPermissions(interaction.user.id);
      await choice.update({
        content: '❌ Last permissions **not loaded**',
        embeds: [],
        components: [],
      });
    }
  } catch {
    // Nobody answered in time, so we forget the previous permissions
    deleteAllHistoricPermissions(interaction.user.id);
    await interaction.editReply({
      content: '🔒 The channel is now **locked**',
      embeds: [],
      components: [],
    });
  }
}

/**
 * The permission history mixes member ids and role ids in a single column, so
 * each id has to be resolved as either one instead of being fed to a member
 * fetch that would choke on the roles.
 */
async function describeAllowed(
  interaction: ChatInputCommandInteraction<'cached'>,
  ids: string[],
): Promise<string> {
  const roleNames: string[] = [];
  const memberIds: string[] = [];

  for (const id of ids) {
    const role = interaction.guild.roles.cache.get(id);
    if (role) roleNames.push(role.toString());
    else memberIds.push(id);
  }

  // Fetched in parallel rather than one after another: serialising these round
  // trips is what pushed this command past Discord's interaction deadline.
  // allSettled rather than a bulk fetch because a single member who has left
  // the guild must not take the whole list down with them.
  const fetched = await Promise.allSettled(
    memberIds.map((id) => interaction.guild.members.fetch(id)),
  );
  const memberNames = fetched
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value.toString());

  return [...roleNames, ...memberNames].join('\n');
}

async function unlockChannel(
  interaction: ChatInputCommandInteraction<'cached'>,
  channel: VoiceChannel,
) {
  await channel.permissionOverwrites.edit(
    interaction.guild.id,
    { Connect: true },
    {
      reason: `Voice Bot: The owner (${interaction.user.username}) wants to unlock the channel`,
    },
  );
  await respond(interaction, { content: '🔓 Channel **unlocked**' });
}

async function permitTarget(
  interaction: ChatInputCommandInteraction<'cached'>,
  channel: VoiceChannel,
) {
  const target = interaction.options.getMentionable('target', true);
  const label =
    target instanceof GuildMember
      ? (target.nickname ?? target.user.username)
      : target instanceof Role
        ? target.name
        : target.username;

  await channel.permissionOverwrites.edit(
    target.id,
    { Connect: true },
    {
      reason: `Voice Bot: The owner (${interaction.user.username}) wants to allow (${label}) in their channel`,
    },
  );
  addHistoricPermission({
    userId: interaction.user.id,
    permittedUserId: target.id,
  });
  await respond(interaction, {
    content: `✅ **${label}** can now join your channel!`,
  });
}

async function rejectMember(
  interaction: ChatInputCommandInteraction<'cached'>,
  channel: VoiceChannel,
) {
  const target = interaction.options.getMember('member');
  if (!target) {
    await respond(interaction, {
      content: 'I could not find this member on the server.',
    });
    return;
  }

  // The original check used `||` where it needed `&&`, so it only ever blocked
  // people who were a moderator *and* an administrator at the same time.
  if (isProtectedFromRejection(target)) {
    await respond(interaction, {
      content: `🛑 Sorry but you can't reject a moderator or an administrator from the channel 😏`,
    });
    return;
  }

  if (target.voice.channelId !== channel.id) {
    await respond(interaction, {
      content: `**${target.nickname ?? target.user.username}** is not in your channel.`,
    });
    return;
  }

  const reason = `Voice Bot: The owner (${interaction.user.username}) kicked (${target.user.username}) out of their channel`;
  await target.voice.disconnect(reason);
  await channel.permissionOverwrites.edit(
    target.id,
    { Connect: false },
    { reason },
  );
  await respond(interaction, {
    content: `💢 **${target.nickname ?? target.user.username}** has been kicked out of the channel!`,
  });
}

async function setChannelLimit(
  interaction: ChatInputCommandInteraction<'cached'>,
  channel: VoiceChannel,
) {
  // Discord already rejects anything outside 0-99 for us
  const count = interaction.options.getInteger('count', true);

  if (channel.parentId) {
    setHistoricLimit(interaction.user.id, channel.parentId, count);
  }
  await channel.setUserLimit(
    count,
    `Voice Bot: Asked by its owner (${interaction.user.username})`,
  );
  await respond(interaction, {
    content: `✋ User limit set to **${count > 0 ? count : 'unlimited'}**`,
  });
}

async function setChannelBitrate(
  interaction: ChatInputCommandInteraction<'cached'>,
  channel: VoiceChannel,
) {
  const bitrate = interaction.options.getInteger('bitrate', true);
  const maximum = maxBitrateFor(interaction.guild.premiumTier);

  if (bitrate > maximum) {
    await respond(interaction, {
      content: `Please give a BPS value between 8000 and ${maximum}.`,
    });
    return;
  }

  await channel.setBitrate(
    bitrate,
    `Voice Bot: Asked by its owner (${interaction.user.username})`,
  );
  await respond(interaction, {
    content: `👂 Channel bitrate set to **${bitrate}bps**`,
  });
}

function maxBitrateFor(tier: GuildPremiumTier): number {
  switch (tier) {
    case GuildPremiumTier.Tier1:
      return 128000;
    case GuildPremiumTier.Tier2:
      return 256000;
    case GuildPremiumTier.Tier3:
      return 384000;
    default:
      // 96kbps is the tier 0 bitrate max
      return 96000;
  }
}

async function claimChannel(
  interaction: ChatInputCommandInteraction<'cached'>,
  channel: VoiceChannel,
  currentOwnerId: string,
) {
  if (currentOwnerId === interaction.user.id) {
    await respond(interaction, { content: 'You already own this channel 🤔' });
    return;
  }

  // Ownership can only change hands once the current owner has left
  if (channel.members.has(currentOwnerId)) {
    await respond(interaction, {
      content: `You can't own this channel right now.`,
    });
    return;
  }

  editOwnership({ ownedChannelId: channel.id, userId: interaction.user.id });
  await respond(interaction, { content: '💪 You now **own** this channel!' });
}
