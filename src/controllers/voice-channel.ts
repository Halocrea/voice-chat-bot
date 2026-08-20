import { ChannelType, VoiceState } from 'discord.js';
import { describeThrown, levelFor, logger } from '../lib/logger';
import { getHistoric } from '../models/Historic';
import { addOwnership, deleteOwnership } from '../models/Ownership';
import {
  getHubByCreatingChannel,
  isManagedCategory,
  VoiceHub,
} from '../models/VoiceHub';

export function handleVoiceEvent(oldState: VoiceState, newState: VoiceState) {
  // Create a voice channel when a user joins one of the guild's trigger
  // channels. Looking the hub up by id also means a disconnection (a null
  // channel id) can never be mistaken for a creation request.
  if (newState.channelId) {
    const hub = getHubByCreatingChannel(newState.channelId);
    if (hub) createVoiceChannel(hub, newState);
  }

  // A null old channel id means the user wasn't in a voice channel before
  if (oldState.channelId) {
    deleteVoiceChannel(oldState, newState);
  }
}

async function createVoiceChannel(hub: VoiceHub, newState: VoiceState) {
  try {
    // We create the channel
    const creatorId = newState.id;
    const creator = await newState.guild.members.fetch(creatorId);
    // Preferences are remembered per sector, so two hubs can hold a different
    // name and user limit for the same member
    const history = getHistoric(creatorId, hub.categoryId);
    const channelName =
      history?.channelName ?? `${creator.user.username}'s channel`;

    const newChannel = await newState.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildVoice,
      parent: hub.categoryId,
      userLimit: history?.userLimit ?? 0,
    });

    // We move the user inside his new channel
    await newState.setChannel(newChannel, 'A user creates a new channel');
    addOwnership({
      userId: creatorId,
      ownedChannelId: newChannel.id,
    });
  } catch (error) {
    logger.log(levelFor(error), 'Could not create a voice channel', {
      err: describeThrown(error),
      guildId: newState.guild.id,
      categoryId: hub.categoryId,
    });
  }
}

async function deleteVoiceChannel(oldState: VoiceState, newState: VoiceState) {
  try {
    const channelLeft = newState.guild.channels.resolve(oldState.channelId!);
    if (
      channelLeft?.isVoiceBased() &&
      !channelLeft.members.size &&
      channelLeft.parentId &&
      isManagedCategory(newState.guild.id, channelLeft.parentId) &&
      // A trigger channel is permanent, it must survive being empty
      !getHubByCreatingChannel(channelLeft.id)
    ) {
      await channelLeft.delete('Channel empty');
      deleteOwnership(channelLeft.id);
    }
  } catch (error) {
    logger.log(levelFor(error), 'Could not delete an empty voice channel', {
      err: describeThrown(error),
      guildId: newState.guild.id,
      channelId: oldState.channelId,
    });
  }
}
