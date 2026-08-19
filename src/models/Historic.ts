import { openDatabase } from './db';
import { historicMigrations } from './migrations';

const db = openDatabase('historic.db', historicMigrations);

export interface Historic {
  userId: string;
  categoryId: string;
  channelName?: string;
  userLimit?: number;
}

export function getHistoric(
  userId: string,
  categoryId: string,
): Historic | undefined {
  return db
    .prepare<[string, string], Historic>(
      'SELECT * FROM historic WHERE userId = ? AND categoryId = ?',
    )
    .get(userId, categoryId);
}

export function setHistoricName(
  userId: string,
  categoryId: string,
  channelName: string,
) {
  const upsert = `INSERT INTO historic (userId, categoryId, channelName)
    VALUES (?, ?, ?)
    ON CONFLICT(userId, categoryId) DO UPDATE SET channelName = excluded.channelName`;
  db.prepare(upsert).run(userId, categoryId, channelName);
}

export function setHistoricLimit(
  userId: string,
  categoryId: string,
  userLimit: number,
) {
  const upsert = `INSERT INTO historic (userId, categoryId, userLimit)
    VALUES (?, ?, ?)
    ON CONFLICT(userId, categoryId) DO UPDATE SET userLimit = excluded.userLimit`;
  db.prepare(upsert).run(userId, categoryId, userLimit);
}
