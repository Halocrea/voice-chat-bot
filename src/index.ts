import * as discord from 'discord.js';
import * as dotenv from 'dotenv';

dotenv.config();
const voiceChatBot = new discord.Client();

voiceChatBot.on('message', (msg) => {
  // msg.channel.send('rofl tg');
});

voiceChatBot.on('voiceStateUpdate', async (oldState, newState) => {
  if (newState.channelID === process.env.CREATING_CHANNEL_ID) {
    console.log(oldState, newState);
    const creator = await newState.guild.members.fetch(newState.id);
    console.log(creator);
    newState.guild.channels.create(`${creator.user.username}'s channel`, { type: 'voice', parent: '562227213185974285' })
  };
});

voiceChatBot.login(process.env.TOKEN);