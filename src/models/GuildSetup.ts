import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, '../../saves/guild_setup.db'));

const createSetupGuild = `CREATE TABLE IF NOT EXISTS guild_setup (
  guildId VARCHAR(30) PRIMARY KEY,
  categoryId VARCHAR(30),
  creatingChannelId VARCHAR(30)
);`;
db.exec(createSetupGuild);

// Slash commands made both the custom prefix and the dedicated commands channel
// pointless, so we drop those columns from databases created before the switch.
// SQLite supports DROP COLUMN since 3.35, and we ship a much newer engine.
const columns = db
  .prepare<[], { name: string }>(`PRAGMA table_info(guild_setup)`)
  .all()
  .map((column) => column.name);
for (const obsolete of ['prefix', 'commandsChannelId']) {
  if (columns.includes(obsolete)) {
    db.exec(`ALTER TABLE guild_setup DROP COLUMN ${obsolete}`);
  }
}

export interface GuildSetup {
  guildId: string;
  // Both stay null until an administrator completes the setup
  categoryId: string | null;
  creatingChannelId: string | null;
}

export function getGuildSetup(guildId: string): GuildSetup | undefined {
  const guildSetup = 'SELECT * FROM guild_setup WHERE guildId = ?';
  return db.prepare<[string], GuildSetup>(guildSetup).get(guildId);
}

/** A setup an administrator has seen through to the end */
export type CompleteGuildSetup = GuildSetup & {
  categoryId: string;
  creatingChannelId: string;
};

/** True once the bot has everything it needs to manage channels on that guild */
export function isSetupComplete(
  guildSetup: GuildSetup | undefined,
): guildSetup is CompleteGuildSetup {
  return !!guildSetup?.categoryId && !!guildSetup.creatingChannelId;
}

export function setGuildSetup(guildSetup: GuildSetup) {
  const upsert = `INSERT INTO guild_setup (guildId, categoryId, creatingChannelId)
    VALUES (@guildId, @categoryId, @creatingChannelId)
    ON CONFLICT(guildId) DO UPDATE SET
      categoryId = excluded.categoryId,
      creatingChannelId = excluded.creatingChannelId`;
  db.prepare(upsert).run(guildSetup);
}

export function setCategoryId(guildId: string, categoryId: string) {
  const upsert = `INSERT INTO guild_setup (guildId, categoryId) VALUES (?, ?)
    ON CONFLICT(guildId) DO UPDATE SET categoryId = excluded.categoryId`;
  db.prepare(upsert).run(guildId, categoryId);
}

export function setCreatingChannelId(
  guildId: string,
  creatingChannelId: string,
) {
  const upsert = `INSERT INTO guild_setup (guildId, creatingChannelId) VALUES (?, ?)
    ON CONFLICT(guildId) DO UPDATE SET creatingChannelId = excluded.creatingChannelId`;
  db.prepare(upsert).run(guildId, creatingChannelId);
}

export function deleteGuildSetup(guildId: string) {
  const removeGuildSetup = 'DELETE FROM guild_setup WHERE guildId = ?';
  db.prepare(removeGuildSetup).run(guildId);
}
