import * as discord from 'discord.js';
import * as dotenv from 'dotenv';

dotenv.config();
const voiceChatBot = new discord.Client();

voiceChatBot.on('message', (msg) => {
  msg.channel.send('rofl tg');
});

voiceChatBot.login(process.env.TOKEN);