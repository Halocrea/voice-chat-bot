import Database from 'better-sqlite3';
import path from 'path';
import { logger } from '../lib/logger';

export type Migration = (db: Database.Database) => void;

const SAVES_DIRECTORY = path.join(__dirname, '../../saves');

/**
 * Opens a database and brings its schema up to date.
 *
 * Versions are tracked with `PRAGMA user_version`, an integer SQLite keeps in
 * the file header. Sniffing the schema to guess what to change (what the first
 * migration used to do) doesn't compose: by the third change you are guessing
 * which of several past states the file is in. A version number turns that into
 * a straight line — every migration runs once, in order, inside a transaction.
 */
export function openDatabase(
  fileName: string,
  migrations: Migration[],
): Database.Database {
  const db = new Database(path.join(SAVES_DIRECTORY, fileName));

  const startingVersion = db.pragma('user_version', {
    simple: true,
  }) as number;

  for (let version = startingVersion; version < migrations.length; version++) {
    db.transaction(() => {
      migrations[version](db);
      db.pragma(`user_version = ${version + 1}`);
    })();
    logger.info(`[db] ${fileName}: migrated to version ${version + 1}`);
  }

  return db;
}

/** Column names of an existing table, empty when the table doesn't exist */
export function columnsOf(db: Database.Database, table: string): string[] {
  return db
    .prepare<[], { name: string }>(`PRAGMA table_info(${table})`)
    .all()
    .map((column) => column.name);
}
