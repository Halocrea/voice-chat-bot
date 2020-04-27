import { VoiceState } from 'discord.js';
import { GuildSetup, getGuildSetup } from '../models/GuildSetup';
import { addOwning, removeOwning } from '../models/Owning';
import { getHistoric } from '../models/Historic';

export function handleVoiceEvent(oldState: VoiceState, newState: VoiceState) {
  const guildSetup = getGuildSetup(newState.guild.id);
  // Create a voice channel when a user join the "creating" channel
  if (newState.channelID === guildSetup.creatingChannelId) {
    createVoiceChannel(guildSetup, newState);
  }

  // Having null as an old state channel id means that the user wasn't in a vocal channel before
  if (oldState.channelID) {
    deleteVoiceChannel(guildSetup, oldState, newState);
  }
}

async function createVoiceChannel(
  guildSetup: GuildSetup,
  newState: VoiceState
) {
  try {
    // We create the channel
    const creatorId = newState.id;
    const creator = await newState.guild.members.fetch(creatorId);
    // We load the user history to get his previous channel name & user limit
    const history = getHistoric(creatorId);
    const channelName =
      history?.channelName ?? `${creator.user.username}'s channel`;

    const newGuildChannel = await newState.guild.channels.create(channelName, {
      type: 'voice',
      parent: guildSetup.categoryId,
      userLimit: history?.userLimit ?? 0,
      permissionOverwrites: [
        {
          id: newState.client.user!.id,
          allow: ['MANAGE_CHANNELS', 'MANAGE_ROLES', 'VIEW_CHANNEL', 'CONNECT'],
        },
      ],
    });

    // We move the user inside his new channel
    const newChannel = await newGuildChannel.fetch();
    newState.setChannel(newChannel, 'A user creates a new channel');
    addOwning({
      userId: creatorId,
      ownedChannelId: newChannel.id,
    });
  } catch (error) {
    console.error(error);
  }
}

async function deleteVoiceChannel(
  guildSetup: GuildSetup,
  oldState: VoiceState,
  newState: VoiceState
) {
  const channelLeft = newState.guild.channels.resolve(oldState.channelID!);
  let memberCount = 0;
  for (const _ of channelLeft!.members) memberCount++;
  if (
    channelLeft &&
    !memberCount &&
    channelLeft.parentID === guildSetup.categoryId &&
    channelLeft.id !== guildSetup.creatingChannelId
  ) {
    try {
      await channelLeft.lockPermissions();
      channelLeft
        .delete('Channel empty')
        .then(() => removeOwning(channelLeft.id))
        .catch(console.error);
    } catch (error) {
      console.error(error);
    }
  }
}
