import { Owning } from '../models/owning.model';
import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, '../../saves/owning.db'), {
  verbose: console.log,
});

const createOwnings = `CREATE TABLE IF NOT EXISTS Ownings (
  ownedChannelId VARCHAR(30) PRIMARY KEY,
  userId VARCHAR(30) NOT NULL
);`;
db.exec(createOwnings);

export function addOwning(owning: Owning) {
  const newOwning =
    'INSERT INTO Ownings (ownedChannelId, userId) VALUES (@ownedChannelId, @userId)';
  db.prepare(newOwning).run(owning);
}

// export function editOwning() {};

export function removeOwning(channelId: string) {
  const deleteOwning = 'DELETE FROM Ownings WHERE ownedChannelId = ?';
  db.prepare(deleteOwning).run(channelId);
}
