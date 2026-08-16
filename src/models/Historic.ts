import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, '../../saves/historic.db'));

const createHistoric = `CREATE TABLE IF NOT EXISTS historic (
  userId VARCHAR(30) PRIMARY KEY,
  channelName VARCHAR(255),
  userLimit TINYINT(2)
);`;
db.exec(createHistoric);

export interface Historic {
  userId: string;
  channelName?: string;
  userLimit?: number;
}

export function getHistoric(userId: string): Historic | undefined {
  const historic = 'SELECT * FROM historic WHERE userId = ?';
  return db.prepare<[string], Historic>(historic).get(userId);
}

export function setHistoricName(userId: string, channelName: string) {
  const upsert = `INSERT INTO historic (userId, channelName) VALUES (?, ?)
    ON CONFLICT(userId) DO UPDATE SET channelName = excluded.channelName`;
  db.prepare(upsert).run(userId, channelName);
}

export function setHistoricLimit(userId: string, userLimit: number) {
  const upsert = `INSERT INTO historic (userId, userLimit) VALUES (?, ?)
    ON CONFLICT(userId) DO UPDATE SET userLimit = excluded.userLimit`;
  db.prepare(upsert).run(userId, userLimit);
}
