import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, '../../saves/ownership.db'));

const createOwnership = `CREATE TABLE IF NOT EXISTS ownership (
  ownedChannelId VARCHAR(30) PRIMARY KEY,
  userId VARCHAR(30) NOT NULL
);`;
db.exec(createOwnership);

export interface Ownership {
  userId: string;
  ownedChannelId: string;
}

export function getOwner(ownedChannelId: string) {
  const owner = 'SELECT userId FROM ownership WHERE ownedChannelId = ?';
  return db.prepare(owner).get(ownedChannelId);
}

export function addOwnership(ownership: Ownership) {
  const newOwnership =
    'INSERT INTO ownership (ownedChannelId, userId) VALUES (@ownedChannelId, @userId)';
  db.prepare(newOwnership).run(ownership);
}

export function editOwnership(ownership: Ownership) {
  const updateOwnership =
    'UPDATE ownership SET userId = ? where ownedChannelId = ?';
  db.prepare(updateOwnership).run([ownership.userId, ownership.ownedChannelId]);
}

export function deleteOwnership(channelId: string) {
  const removeOwnership = 'DELETE FROM ownership WHERE ownedChannelId = ?';
  db.prepare(removeOwnership).run(channelId);
}
