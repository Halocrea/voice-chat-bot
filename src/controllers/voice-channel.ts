import { ChannelType, VoiceState } from 'discord.js';
import { GuildSetup, getGuildSetup } from '../models/GuildSetup';
import { getHistoric } from '../models/Historic';
import { addOwnership, deleteOwnership } from '../models/Ownership';

export function handleVoiceEvent(oldState: VoiceState, newState: VoiceState) {
  const guildSetup = getGuildSetup(newState.guild.id);
  // Nothing to do on a guild that hasn't run the setup yet
  if (!guildSetup) return;

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
  guildSetup: GuildSetup,
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
  guildSetup: GuildSetup,
  oldState: VoiceState,
  newState: VoiceState,
) {
  const channelLeft = newState.guild.channels.resolve(oldState.channelId!);
  if (
    channelLeft?.isVoiceBased() &&
    !channelLeft.members.size &&
    channelLeft.parentId === guildSetup.categoryId &&
    channelLeft.id !== guildSetup.creatingChannelId
  ) {
    try {
      await channelLeft.delete('Channel empty');
      deleteOwnership(channelLeft.id);
    } catch (error) {
      console.error(error);
    }
  }
}
