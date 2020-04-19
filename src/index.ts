import * as discord from 'discord.js';
import * as dotenv from 'dotenv';
import { addOwning, removeOwning } from './utils/owning-manager';

dotenv.config();
const voiceChatBot = new discord.Client();

voiceChatBot.on('message', msg => {
  // msg.channel.send('rofl tg');
});

voiceChatBot.on('voiceStateUpdate', async (oldState, newState) => {
  // Create a voice channel when a user join the "creating" channel
  if (newState.channelID === process.env.CREATING_CHANNEL_ID) {
    try {
      // We create the channel
      const creator = await newState.guild.members.fetch(newState.id);
      const newGuildChannel = await newState.guild.channels.create(`${creator.user.username}'s channel`, { type: 'voice', parent: process.env.VOICE_CATEGORY_ID })
      // We move the user inside his new channel
      const newChannel = await newGuildChannel.fetch();
      newState.setChannel(newChannel, 'A user creates a new channel');
      addOwning({
        userId: newState.id,
        ownedChannelId: newChannel.id
      });
    } catch (error) {
      console.error(error);
    }
  }

  // Having null as an old state channel id means that the user wasn't in a vocal channel before
  if (oldState.channelID) {
    const channelLeft = newState.guild.channels.resolve(oldState.channelID);
    let memberCount = 0;
    for (const _ of channelLeft!.members)
      memberCount++
    if (
      channelLeft &&
      !memberCount &&
      channelLeft.id !== process.env.CREATING_CHANNEL_ID
    ) {
      removeOwning(channelLeft.id);
      channelLeft.delete('Channel empty')
      .then(() => console.log('channel deleted'))
      .catch(console.error);
    }
  }
});

voiceChatBot.login(process.env.TOKEN);