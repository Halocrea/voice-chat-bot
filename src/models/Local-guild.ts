import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, '../../saves/local_guild.db'), {
  verbose: console.log,
});

const localGuilds = `CREATE TABLE IF NOT EXISTS Local_guilds (
  guildId VARCHAR(30) PRIMARY KEY,
  prefix VARCHAR(15),
  categoryId VARCHAR(30),
  creatingChannelId VARCHAR(30),
  commandsChannelId VARCHAR(30)
);`;
db.exec(localGuilds);

export interface LocalGuild {
  guildId: string;
  prefix: string;
  categoryId: string;
  creatingChannelId: string;
  commandsChannelId: string;
}

export function getLocalGuild(guildId: string): LocalGuild {
  const localGuild = 'SELECT * FROM Local_guilds WHERE guildId = ?';
  return db.prepare(localGuild).get(guildId);
}

export function addLocalGuild(localGuild: LocalGuild) {
  const newLocalGuild =
    'INSERT INTO Local_guilds (guildId, prefix, categoryId, creatingChannelId, commandsChannelId) VALUES (@guildId, @prefix, @categoryId, @creatingChannelId, @commandsChannelId)';
  return db.prepare(newLocalGuild).run(localGuild);
}

export function addLocalGuildId(guildId: string) {
  const newLocalGuild = 'INSERT INTO Local_guilds (guildId) VALUES (@guildId)';
  db.prepare(newLocalGuild).run({ guildId });
}

export function editPrefix(guildId: string, prefix: string) {
  const updatePrefix = 'UPDATE Local_guilds SET prefix = ? WHERE guildId = ?';
  db.prepare(updatePrefix).run([prefix, guildId]);
}

export function editCategoryId(guildId: string, categoryId: string) {
  const updateCategoryId =
    'UPDATE Local_guilds SET categoryId = ? WHERE guildId = ?';
  db.prepare(updateCategoryId).run([categoryId, guildId]);
}

export function editCreatingChannelId(
  guildId: string,
  creatingChannelId: string
) {
  const updateCreatingChannelId =
    'UPDATE Local_guilds SET creatingChannelId = ? WHERE guildId = ?';
  db.prepare(updateCreatingChannelId).run([creatingChannelId, guildId]);
}

export function editCommandsChannelId(
  guildId: string,
  commandsChannelId: string
) {
  const updateCommandsChannelId =
    'UPDATE Local_guilds SET commandsChannelId = ? WHERE guildId = ?';
  db.prepare(updateCommandsChannelId).run([commandsChannelId, guildId]);
}

export function removeLocalGuild(guildId: string) {
  const deleteLocalGuild = 'DELETE FROM Local_guilds WHERE guildId = ?';
  db.prepare(deleteLocalGuild).run(guildId);
}
