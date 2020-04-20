import Database from 'better-sqlite3';
import path from 'path';
import { HistoryName } from '../models/history-name.model';

const db = new Database(path.join(__dirname, '../../saves/history_name.db'), {
  verbose: console.log,
});

const createOwnings = `CREATE TABLE IF NOT EXISTS History_names (
  userId VARCHAR(30) PRIMARY KEY,
  channelName VARCHAR(255) NOT NULL
);`;
db.exec(createOwnings);

export function getChannelName(userId: string) {
  const historyName = 'SELECT channelName FROM History_names WHERE userId = ?';
  return db.prepare(historyName).get(userId).channelName;
}

export function addHistoryName(historyName: HistoryName) {
  const newHistoryName =
    'INSERT INTO History_names (userId, channelName) VALUES (@userId, @channelName)';
  db.prepare(newHistoryName).run(historyName);
}

export function editHistoryName(historyName: HistoryName) {
  const updateHistoryName =
    'UPDATE History_names SET channelName = ? WHERE userId = ?';
  db.prepare(updateHistoryName).run([
    historyName.channelName,
    historyName.channelName,
  ]);
}

export function removeHistoryName(userId: string) {
  const deleteHistoryName = 'DELETE FROM History_names WHERE userId = ?';
  db.prepare(deleteHistoryName).run(userId);
}
