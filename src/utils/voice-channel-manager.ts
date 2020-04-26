import { VoiceState } from 'discord.js';
import { getLocalGuild } from './local-guild-manager';
import { addOwning, removeOwning } from './owning-manager';
import { LocalGuild } from '../types/local-guild.model';
import { getHistoric } from './history-manager';

export async function handleVoiceEvent(
  oldState: VoiceState,
  newState: VoiceState
) {
  const localGuild = getLocalGuild(newState.guild.id);
  // Create a voice channel when a user join the "creating" channel
  if (newState.channelID === localGuild.creatingChannelId) {
    createVoiceChannel(localGuild, newState);
  }

  // Having null as an old state channel id means that the user wasn't in a vocal channel before
  if (oldState.channelID) {
    deleteVoiceChannel(localGuild, oldState, newState);
  }
}

async function createVoiceChannel(
  localGuild: LocalGuild,
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
      parent: localGuild.categoryId,
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
  localGuild: LocalGuild,
  oldState: VoiceState,
  newState: VoiceState
) {
  const channelLeft = newState.guild.channels.resolve(oldState.channelID!);
  let memberCount = 0;
  for (const _ of channelLeft!.members) memberCount++;
  if (
    channelLeft &&
    !memberCount &&
    channelLeft.parentID === localGuild.categoryId &&
    channelLeft.id !== localGuild.creatingChannelId
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
