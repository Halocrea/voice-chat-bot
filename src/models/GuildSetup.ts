import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, '../../saves/guild_setup.db'));

const createSetupGuild = `CREATE TABLE IF NOT EXISTS guild_setup (
  guildId VARCHAR(30) PRIMARY KEY,
  prefix VARCHAR(15),
  categoryId VARCHAR(30),
  creatingChannelId VARCHAR(30),
  commandsChannelId VARCHAR(30)
);`;
db.exec(createSetupGuild);

export interface GuildSetup {
  guildId: string;
  prefix: string;
  categoryId: string;
  creatingChannelId: string;
  commandsChannelId: string;
}

export function getGuildSetup(guildId: string): GuildSetup {
  const guildSetup = 'SELECT * FROM guild_setup WHERE guildId = ?';
  return db.prepare(guildSetup).get(guildId);
}

export function addGuildSetup(guildSetup: GuildSetup) {
  const newGuildSetup =
    'INSERT INTO guild_setup (guildId, prefix, categoryId, creatingChannelId, commandsChannelId) VALUES (@guildId, @prefix, @categoryId, @creatingChannelId, @commandsChannelId)';
  return db.prepare(newGuildSetup).run(guildSetup);
}

export function addGuildSetupId(guildId: string) {
  const newGuildSetup = 'INSERT INTO guild_setup (guildId) VALUES (@guildId)';
  db.prepare(newGuildSetup).run({ guildId });
}

export function editPrefix(guildId: string, prefix: string) {
  const updatePrefix = 'UPDATE guild_setup SET prefix = ? WHERE guildId = ?';
  db.prepare(updatePrefix).run([prefix, guildId]);
}

export function editCategoryId(guildId: string, categoryId: string) {
  const updateCategoryId =
    'UPDATE guild_setup SET categoryId = ? WHERE guildId = ?';
  db.prepare(updateCategoryId).run([categoryId, guildId]);
}

export function editCreatingChannelId(
  guildId: string,
  creatingChannelId: string
) {
  const updateCreatingChannelId =
    'UPDATE guild_setup SET creatingChannelId = ? WHERE guildId = ?';
  db.prepare(updateCreatingChannelId).run([creatingChannelId, guildId]);
}

export function editCommandsChannelId(
  guildId: string,
  commandsChannelId: string
) {
  const updateCommandsChannelId =
    'UPDATE guild_setup SET commandsChannelId = ? WHERE guildId = ?';
  db.prepare(updateCommandsChannelId).run([commandsChannelId, guildId]);
}

export function deleteGuildSetup(guildId: string) {
  const removeGuildSetup = 'DELETE FROM guild_setup WHERE guildId = ?';
  db.prepare(removeGuildSetup).run(guildId);
}
