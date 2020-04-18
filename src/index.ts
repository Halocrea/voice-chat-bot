import * as discord from 'discord.js';
import * as dotenv from 'dotenv';

dotenv.config();
const voiceChatBot = new discord.Client();

voiceChatBot.on('message', msg => {
  // msg.channel.send('rofl tg');
});

voiceChatBot.on('voiceStateUpdate', async (oldState, newState) => {
  // Create a voice channel when a user join the "creating" channel
  if (newState.channelID === process.env.CREATING_CHANNEL_ID) {
    // We create the channel
    const creator = await newState.guild.members.fetch(newState.id);
    newState.guild.channels.create(`${creator.user.username}'s channel`, { type: 'voice', parent: process.env.VOICE_CATEGORY_ID })
    // TODO: Then we move the user to the new channel

  }

  if (oldState.channelID) { // Having null as an old state channel id means that the user wasn't in a vocal channel before
    const channelLeft = newState.guild.channels.resolve(oldState.channelID!);
    let memberCount = 0;
    for (const member of channelLeft!.members)
      memberCount++
    if (
      channelLeft &&
      !memberCount &&
      channelLeft.id !== process.env.CREATING_CHANNEL_ID
    ) {
      channelLeft.delete()
      .then(() => console.log('channel deleted'))
      .catch(console.error);
    }
  }
});

voiceChatBot.login(process.env.TOKEN);