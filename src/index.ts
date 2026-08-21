import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
} from 'discord.js';
import { commands } from './commands';
import { handleVoiceEvent } from './controllers/voice-channel';
// Loads the .env. Imported rather than called here: the modules below are built
// while they are imported, which happens before any statement in this file.
import './lib/env';
import { startHeartbeat } from './lib/heartbeat';
import { describeThrown, logger } from './lib/logger';
import { reconcileHubs } from './lib/reconcile';
import { removeAllHubs } from './models/VoiceHub';

// A throwing handler used to take the whole process down: since Node 15 an
// unhandled rejection is fatal, and a restart policy just fed the bot back into
// the same error. Logging beats dying for an error we already know how to skip.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { err: describeThrown(reason) });
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { err: describeThrown(error) });
});

const registry = new Map(
  commands.map((command) => [command.data.name, command]),
);

// Slash commands need no privileged intent: dropping the prefixed commands took
// MessageContent, GuildMessages and GuildMessageReactions with them.
const voiceChatBot = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

voiceChatBot.on(Events.ClientReady, (client) => {
  client.user.setActivity(`Made with ❤️`, { type: ActivityType.Listening });
  logger.info(`Logged in as ${client.user.tag}`, {
    guilds: client.guilds.cache.size,
  });

  // Only here: the guild cache is what tells us which sectors still have a
  // server behind them, and it is only complete once Discord has sent the list
  reconcileHubs(client);
});

// Discord emits this on a real removal only — an outage surfaces as
// `guildUnavailable` instead, so this cannot wipe a live server's setup
voiceChatBot.on(Events.GuildDelete, (guild) => {
  const removed = removeAllHubs(guild.id);
  if (removed) {
    logger.info(`Removed from a guild, forgot ${removed} sector(s)`, {
      guildId: guild.id,
    });
  }
});

voiceChatBot.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: 'These commands only work on a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const command = registry.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    // Commands handle their own errors; reaching here means one escaped, which
    // is a bug rather than a misconfigured server
    logger.error(`/${interaction.commandName} threw past its own handler`, {
      err: describeThrown(error),
      guildId: interaction.guildId,
    });
  }
});

voiceChatBot.on(Events.VoiceStateUpdate, (oldState, newState) => {
  try {
    handleVoiceEvent(oldState, newState);
  } catch (error) {
    logger.error('Voice state handler threw', {
      err: describeThrown(error),
      guildId: newState.guild.id,
    });
  }
});

voiceChatBot.login(process.env.TOKEN);

// Started right away rather than on ready: if the bot never manages to connect,
// the beats are skipped, the monitor hears silence, and you are told — which is
// exactly what should happen.
startHeartbeat(voiceChatBot);
