import { ChannelType, VoiceState } from 'discord.js';
import {
  CompleteGuildSetup,
  getGuildSetup,
  isSetupComplete,
} from '../models/GuildSetup';
import { getHistoric } from '../models/Historic';
import { addOwnership, deleteOwnership } from '../models/Ownership';

export function handleVoiceEvent(oldState: VoiceState, newState: VoiceState) {
  const guildSetup = getGuildSetup(newState.guild.id);
  // Nothing to do until an administrator has finished the setup. Checking the
  // ids individually also matters: both are null on a half-configured guild,
  // and `null === null` would make every disconnection look like a request for
  // a brand new channel.
  if (!isSetupComplete(guildSetup)) return;

  // Create a voice channel when a user join the "creating" channel
  if (newState.channelId === guildSetup.creatingChannelId) {
    createVoiceChannel(guildSetup, newState);
  }

  // Having null as an old state channel id means that the user wasn't in a vocal channel before
  if (oldState.channelId) {
    deleteVoiceChannel(guildSetup, oldState, newState);
  }
}

async function createVoiceChannel(
  guildSetup: CompleteGuildSetup,
  newState: VoiceState,
) {
  try {
    // We create the channel
    const creatorId = newState.id;
    const creator = await newState.guild.members.fetch(creatorId);
    // We load the user history to get his previous channel name & user limit
    const history = getHistoric(creatorId);
    const channelName =
      history?.channelName ?? `${creator.user.username}'s channel`;

    const newChannel = await newState.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildVoice,
      parent: guildSetup.categoryId,
      userLimit: history?.userLimit ?? 0,
    });

    // We move the user inside his new channel
    await newState.setChannel(newChannel, 'A user creates a new channel');
    addOwnership({
      userId: creatorId,
      ownedChannelId: newChannel.id,
    });
  } catch (error) {
    console.error(error);
  }
}

async function deleteVoiceChannel(
  guildSetup: CompleteGuildSetup,
  oldState: VoiceState,
  newState: VoiceState,
) {
  try {
    const channelLeft = newState.guild.channels.resolve(oldState.channelId!);
    if (
      channelLeft?.isVoiceBased() &&
      !channelLeft.members.size &&
      channelLeft.parentId === guildSetup.categoryId &&
      channelLeft.id !== guildSetup.creatingChannelId
    ) {
      await channelLeft.delete('Channel empty');
      deleteOwnership(channelLeft.id);
    }
  } catch (error) {
    console.error(error);
  }
}
