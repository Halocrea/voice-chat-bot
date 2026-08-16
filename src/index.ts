import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
} from 'discord.js';
import * as dotenv from 'dotenv';
import { commands } from './commands';
import { handleVoiceEvent } from './controllers/voice-channel';

dotenv.config();

// A throwing handler used to take the whole process down: since Node 15 an
// unhandled rejection is fatal, and a restart policy just fed the bot back into
// the same error. Logging beats dying for an error we already know how to skip.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
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
  console.log(`Logged in as ${client.user.tag}`);
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
    // Commands handle their own errors; this is the last resort so that a bug
    // never escapes as an unhandled rejection
    console.error(error);
  }
});

voiceChatBot.on(Events.VoiceStateUpdate, (oldState, newState) => {
  try {
    handleVoiceEvent(oldState, newState);
  } catch (error) {
    console.error(error);
  }
});

voiceChatBot.login(process.env.TOKEN);
