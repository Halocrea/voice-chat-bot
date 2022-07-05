import * as discord from 'discord.js';
import * as dotenv from 'dotenv';
import { handleCommand } from './controllers/command';
import { handleModeration } from './controllers/handle-moderation';
import { handleSetup } from './controllers/setup';
import { handleVoiceEvent } from './controllers/voice-channel';
import { getGuildSetup } from './models/GuildSetup';

dotenv.config();
const voiceChatBot = new discord.Client({
  ws: {
    intents: [
      'GUILDS',
      'GUILD_MESSAGES',
      'GUILD_MESSAGE_REACTIONS',
      'GUILD_VOICE_STATES',
    ],
  },
});

voiceChatBot.on('ready', () => {
  voiceChatBot.user?.setActivity(`Made with ❤️`, {
    type: 'LISTENING',
  });
});

voiceChatBot.on('message', (msg) => {
  if (!msg.guild) return;

  // We get the local setup
  const guildSetup = getGuildSetup(msg.guild!.id);
  const cmdPrefix =
    guildSetup && guildSetup.prefix
      ? guildSetup.prefix
      : process.env.CMD_PREFIX;
  if (cmdPrefix && msg.content.startsWith(cmdPrefix)) {
    const cmdAndArgs = msg.content.replace(cmdPrefix, '').trim().split(' ');
    const cmd = cmdAndArgs.shift();
    const args = cmdAndArgs.join(' ').trim();

    if (
      cmd?.match(/setup/) &&
      (msg.member?.hasPermission('ADMINISTRATOR') ||
        process.env.MAINTAINER_ID === msg.author.id)
    ) {
      handleSetup(voiceChatBot, guildSetup, msg, cmdPrefix, cmd, args);
    } else if (
      cmd?.match(/moderation/) &&
      (msg.member?.hasPermission('ADMINISTRATOR') ||
        process.env.MAINTAINER_ID === msg.author.id)
    ) {
      handleModeration(voiceChatBot, msg, cmd);
    } else if (guildSetup && cmd) {
      handleCommand(voiceChatBot, msg, cmd, args);
    } else if (!cmd) {
      msg.channel.send(`Don't forget to use a command 😏`);
    } else {
      // The bot needs to be set up before being used
      const embed = new discord.MessageEmbed({
        title: 'DENIED! Please set me up and configure me first.',
        description: `Please ask an Administrator to configure me using the \`${process.env.CMD_PREFIX} setup\` command; I require a few additionnal info to get things to work ☹️`,
        color: 16711680,
        thumbnail: {
          url: voiceChatBot.user?.avatarURL() ?? undefined,
        },
        image: {
          url: 'https://i.imgur.com/ZIfiTGO.gif',
        },
        timestamp: new Date(),
        author: {
          name: voiceChatBot.user?.username,
          icon_url: voiceChatBot.user?.avatarURL() ?? undefined,
        }
      });
      msg.channel.send(embed);
    }
  }
});

voiceChatBot.on('voiceStateUpdate', async (oldState: discord.VoiceState, newState: discord.VoiceState) =>
  handleVoiceEvent(oldState, newState)
);

voiceChatBot.login(process.env.TOKEN);
