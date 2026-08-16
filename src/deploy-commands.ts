import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import { commands } from './commands';

dotenv.config();

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const devGuildId = process.env.DEV_GUILD_ID;

if (!token || !clientId) {
  console.error(
    'TOKEN and CLIENT_ID must both be set in your .env before deploying commands.',
  );
  process.exit(1);
}

const rest = new REST().setToken(token);
const body = commands.map((command) => command.data.toJSON());

async function deploy() {
  // Guild-scoped commands show up instantly, which is what you want while
  // developing. Global ones can take up to an hour to propagate.
  const route = devGuildId
    ? Routes.applicationGuildCommands(clientId!, devGuildId)
    : Routes.applicationCommands(clientId!);

  await rest.put(route, { body });

  console.log(
    devGuildId
      ? `Deployed ${commands.length} commands to guild ${devGuildId}.`
      : `Deployed ${commands.length} commands globally (up to an hour to appear).`,
  );
}

deploy().catch((error) => {
  console.error(error);
  process.exit(1);
});
