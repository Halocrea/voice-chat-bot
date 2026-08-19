import { columnsOf, Migration } from './db';

/**
 * Every schema change the bot has ever made, in one place.
 *
 * ⚠️ These lists are APPEND-ONLY. A migration's position in its array *is* its
 * version number, the one stored in the database file via `PRAGMA user_version`.
 * Inserting or reordering an entry would make already-migrated databases skip
 * or replay the wrong step, silently. Adding at the end is the only safe edit,
 * and a migration that has shipped is never modified again.
 *
 * Each one runs at most once, inside a transaction. Write them so they are
 * harmless on a brand new database as well as on the oldest one still in the
 * wild — the bot runs on servers whose data we cannot inspect.
 */

export const guildSetupMigrations: Migration[] = [
  // 1 — slash commands made the custom prefix and the dedicated commands
  // channel pointless. Guarded so it is a no-op on a database that never knew
  // those columns.
  (db) => {
    const columns = columnsOf(db, 'guild_setup');
    if (!columns.length) return;
    for (const obsolete of ['prefix', 'commandsChannelId']) {
      if (columns.includes(obsolete)) {
        db.exec(`ALTER TABLE guild_setup DROP COLUMN ${obsolete}`);
      }
    }
  },

  // 2 — a guild is no longer limited to a single category. Each (category,
  // trigger channel) pair becomes a hub, and a guild may own several.
  (db) => {
    db.exec(`CREATE TABLE IF NOT EXISTS voice_hub (
      creatingChannelId VARCHAR(30) PRIMARY KEY,
      guildId           VARCHAR(30) NOT NULL,
      categoryId        VARCHAR(30) NOT NULL
    );`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_voice_hub_category
             ON voice_hub (guildId, categoryId);`);

    if (!columnsOf(db, 'guild_setup').length) return;

    const migrated = db
      .prepare(
        `INSERT OR IGNORE INTO voice_hub (creatingChannelId, guildId, categoryId)
         SELECT creatingChannelId, guildId, categoryId FROM guild_setup
          WHERE categoryId IS NOT NULL AND creatingChannelId IS NOT NULL`,
      )
      .run().changes;

    // Those guilds never finished their setup, so the bot already ignored them
    const skipped =
      db
        .prepare<[], { count: number }>(
          `SELECT COUNT(*) AS count FROM guild_setup
            WHERE categoryId IS NULL OR creatingChannelId IS NULL`,
        )
        .get()?.count ?? 0;

    console.log(
      `[db] guild_setup -> voice_hub: ${migrated} hub(s) migrated, ` +
        `${skipped} incomplete setup(s) skipped`,
    );

    // guild_setup is deliberately left in place, unread, as a safety net for
    // one release. A later migration will drop it.
  },

  // 3 — a sector *is* a category, so a category holds exactly one trigger
  // channel. Without this, several triggers could share a category while the
  // preferences kept in `historic` are keyed on the category alone: the sectors
  // would be indistinguishable in every way that matters, and `list` would show
  // duplicate-looking rows.
  (db) => {
    const duplicates = db
      .prepare(
        `DELETE FROM voice_hub WHERE rowid NOT IN (
           SELECT MIN(rowid) FROM voice_hub GROUP BY guildId, categoryId
         )`,
      )
      .run().changes;

    if (duplicates) {
      console.log(
        `[db] voice_hub: ${duplicates} duplicate hub(s) dropped, ` +
          `one trigger channel kept per category`,
      );
    }

    db.exec('DROP INDEX IF EXISTS idx_voice_hub_category;');
    db.exec(`CREATE UNIQUE INDEX idx_voice_hub_category
             ON voice_hub (guildId, categoryId);`);
  },
];

export const historicMigrations: Migration[] = [
  // 1 — preferences become per category instead of per member.
  (db) => {
    const columns = columnsOf(db, 'historic');

    // The old table was keyed on userId alone, so a member's channel name was
    // shared across every guild and every category the bot served. Those rows
    // cannot be attributed to a category after the fact, so they are set aside
    // rather than destroyed: a member simply renames their channel once and it
    // is remembered again, this time per sector.
    if (columns.length && !columns.includes('categoryId')) {
      db.exec('ALTER TABLE historic RENAME TO historic_global_v1');
    }

    db.exec(`CREATE TABLE IF NOT EXISTS historic (
      userId      VARCHAR(30) NOT NULL,
      categoryId  VARCHAR(30) NOT NULL,
      channelName VARCHAR(255),
      userLimit   TINYINT(2),
      PRIMARY KEY (userId, categoryId)
    );`);
  },
];

export const ownershipMigrations: Migration[] = [
  (db) =>
    db.exec(`CREATE TABLE IF NOT EXISTS ownership (
      ownedChannelId VARCHAR(30) PRIMARY KEY,
      userId         VARCHAR(30) NOT NULL
    );`),
];

export const moderationRoleMigrations: Migration[] = [
  (db) =>
    db.exec(`CREATE TABLE IF NOT EXISTS moderation_role (
      guildId VARCHAR(30) NOT NULL,
      roleId  VARCHAR(30) NOT NULL
    );`),
];

export const historicPermissionMigrations: Migration[] = [
  (db) =>
    db.exec(`CREATE TABLE IF NOT EXISTS historic_permission (
      userId          VARCHAR(30) NOT NULL,
      permittedUserId VARCHAR(30) NOT NULL
    );`),
];
