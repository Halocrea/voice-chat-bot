import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, '../../saves/historic.db'), {
  verbose: console.log,
});

const createHistoric = `CREATE TABLE IF NOT EXISTS Historic (
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

export function getHistoric(userId: string): Historic {
  const historic = 'SELECT * FROM Historic WHERE userId = ?';
  return db.prepare(historic).get(userId);
}

export function addHistoricName(historic: Historic) {
  const newHistoric =
    'INSERT INTO Historic (userId, channelName) VALUES (@userId, @channelName)';
  db.prepare(newHistoric).run(historic);
}

export function addHistoricLimit(historic: Historic) {
  const newHistoric =
    'INSERT INTO Historic (userId, userLimit) values (@userId, @userLimit)';
  db.prepare(newHistoric).run(historic);
}

export function editHistoricName(historic: Historic) {
  const updateHistoricName =
    'UPDATE Historic SET channelName = ? WHERE userId = ?';
  db.prepare(updateHistoricName).run([historic.channelName, historic.userId]);
}

export function editHistoricLimit(historic: Historic) {
  const updateHistoricLimit =
    'UPDATE Historic SET userLimit = ? WHERE userId = ?';
  db.prepare(updateHistoricLimit).run([historic.userLimit, historic.userId]);
}

export function removeHistoricName(userId: string) {
  const deleteHistoricName = 'DELETE FROM Historic WHERE userId = ?';
  db.prepare(deleteHistoricName).run(userId);
}
