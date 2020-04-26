import * as discord from 'discord.js';
import * as dotenv from 'dotenv';
import { handleCommand } from './utils/command-manager';
import { handleSetup } from './utils/setup-manager';
import { getLocalGuild } from './utils/local-guild-manager';
import { handleVoiceEvent } from './utils/voice-channel-manager';

dotenv.config();
const voiceChatBot = new discord.Client();

voiceChatBot.on('ready', () => {
  voiceChatBot.user?.setActivity(`${process.env.CMD_PREFIX} help`, {
    type: 'LISTENING',
  });
});

voiceChatBot.on('message', async (msg) => {
  if (!msg.guild) return;

  // We get the local setup
  const localGuild = getLocalGuild(msg.guild!.id);
  const cmdPrefix =
    localGuild && localGuild.prefix
      ? localGuild.prefix
      : process.env.CMD_PREFIX;
  if (cmdPrefix && msg.content.startsWith(cmdPrefix)) {
    const cmdAndArgs = msg.content.replace(cmdPrefix, '').trim().split(' ');
    const cmd = cmdAndArgs.shift();
    const args = cmdAndArgs.join(' ').trim();

    if (cmd?.match(/setup/) && msg.member?.hasPermission('ADMINISTRATOR')) {
      handleSetup(voiceChatBot, msg, cmd, args);
    } else if (localGuild && cmd) {
      handleCommand(voiceChatBot, msg, cmd, args);
    } else if (!cmd) {
      msg.channel.send(`Don't forget to use a command 😏`);
    } else {
      // The bot needs to be set up before being used
      msg.channel.send({
        embed: {
          title: 'DENIED! I need to be installed before being used',
          description:
            'Please ask an Administrator to install me using `!voice setup` command to use me, I need some configuration ☹️',
          color: 16711680,
          thumbnail: {
            url: voiceChatBot.user?.avatarURL(),
          },
          image: {
            url: 'https://i.imgur.com/ZIfiTGO.gif',
          },
          timestamp: new Date(),
          author: {
            name: voiceChatBot.user?.username,
            icon_url: voiceChatBot.user?.avatarURL(),
          },
        },
      });
    }
  }
});

voiceChatBot.on('voiceStateUpdate', async (oldState, newState) =>
  handleVoiceEvent(oldState, newState)
);

voiceChatBot.login(process.env.TOKEN);
