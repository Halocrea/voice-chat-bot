import Database from 'better-sqlite3';
import path from 'path';
import { History } from '../models/history.model';

const db = new Database(path.join(__dirname, '../../saves/history.db'), {
  verbose: console.log,
});

const createHistory = `CREATE TABLE IF NOT EXISTS History (
  userId VARCHAR(30) PRIMARY KEY,
  channelName VARCHAR(255),
  userLimit TINYINT(2)
);`;
db.exec(createHistory);

export function getHistory(userId: string): History {
  const history = 'SELECT * FROM History WHERE userId = ?';
  return db.prepare(history).get(userId);
}

export function addHistoryName(history: History) {
  const newHistory =
    'INSERT INTO History (userId, channelName) VALUES (@userId, @channelName)';
  db.prepare(newHistory).run(history);
}

export function addHistoryLimit(history: History) {
  const newHistory =
    'INSERT INTO History (userId, userLimit) values (@userId, @userLimit)';
  db.prepare(newHistory).run(history);
}

// export function addUserLimit(history: History) {
//   const newHistory =
//     'INSERT INTO History (userId, userLimit) VALUES (@userId, @userLimit)';
//   db.prepare(newHistory).run(history);
// }

export function editHistoryName(history: History) {
  const updateHistoryName =
    'UPDATE History SET channelName = ? WHERE userId = ?';
  db.prepare(updateHistoryName).run([history.channelName, history.userId]);
}

export function editHistoryLimit(history: History) {
  const updateHistoryLimit = 'UPDATE History SET userLimit = ? WHERE userId = ?';
  db.prepare(updateHistoryLimit).run([history.userLimit, history.userId]);
}

export function removeHistoryName(userId: string) {
  const deleteHistoryName = 'DELETE FROM History WHERE userId = ?';
  db.prepare(deleteHistoryName).run(userId);
}
