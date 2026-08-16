import {
  ActivityType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
} from 'discord.js';
import * as dotenv from 'dotenv';
import { handleCommand } from './controllers/command';
import { handleModeration } from './controllers/handle-moderation';
import { handleSetup } from './controllers/setup';
import { handleVoiceEvent } from './controllers/voice-channel';
import { getGuildSetup } from './models/GuildSetup';

dotenv.config();
const voiceChatBot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    // Privileged intent: it must be enabled on the Discord developer portal,
    // otherwise msg.content stays empty and no prefixed command is ever matched
    GatewayIntentBits.MessageContent,
  ],
});

voiceChatBot.on(Events.ClientReady, () => {
  voiceChatBot.user?.setActivity(`Made with ❤️`, {
    type: ActivityType.Listening,
  });
});

voiceChatBot.on(Events.MessageCreate, (msg) => {
  if (!msg.guild) return;

  // Narrowed once here so every send() below is known to be safe
  const channel = msg.channel;
  if (!channel.isSendable()) return;

  // We get the local setup
  const guildSetup = getGuildSetup(msg.guild.id);
  const cmdPrefix =
    guildSetup && guildSetup.prefix
      ? guildSetup.prefix
      : process.env.CMD_PREFIX;
  if (cmdPrefix && msg.content.startsWith(cmdPrefix)) {
    const cmdAndArgs = msg.content.replace(cmdPrefix, '').trim().split(' ');
    const cmd = cmdAndArgs.shift();
    const args = cmdAndArgs.join(' ').trim();

    const isAdmin =
      msg.member?.permissions.has(PermissionFlagsBits.Administrator) ||
      process.env.MAINTAINER_ID === msg.author.id;

    if (cmd?.match(/setup/) && isAdmin) {
      handleSetup(voiceChatBot, guildSetup, msg, cmdPrefix, cmd, args);
    } else if (cmd?.match(/moderation/) && isAdmin) {
      handleModeration(voiceChatBot, msg, cmd);
    } else if (guildSetup && cmd) {
      handleCommand(voiceChatBot, msg, cmd, args);
    } else if (!cmd) {
      channel.send(`Don't forget to use a command 😏`);
    } else {
      // The bot needs to be set up before being used
      channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('DENIED! Please set me up and configure me first.')
            .setDescription(
              `Please ask an Administrator to configure me using the \`${process.env.CMD_PREFIX} setup\` command; I require a few additionnal info to get things to work ☹️`,
            )
            .setColor(16711680)
            .setThumbnail(voiceChatBot.user?.avatarURL() ?? null)
            .setImage('https://i.imgur.com/ZIfiTGO.gif')
            .setTimestamp(new Date())
            .setAuthor({
              name: voiceChatBot.user?.username ?? 'Voice Chat Bot',
              iconURL: voiceChatBot.user?.avatarURL() ?? undefined,
            }),
        ],
      });
    }
  }
});

voiceChatBot.on(Events.VoiceStateUpdate, async (oldState, newState) =>
  handleVoiceEvent(oldState, newState),
);

voiceChatBot.login(process.env.TOKEN);
