import { openDatabase } from './db';
import { ownershipMigrations } from './migrations';

const db = openDatabase('ownership.db', ownershipMigrations);

export interface Ownership {
  userId: string;
  ownedChannelId: string;
}

export function getOwner(
  ownedChannelId: string,
): { userId: string } | undefined {
  const owner = 'SELECT userId FROM ownership WHERE ownedChannelId = ?';
  return db.prepare<[string], { userId: string }>(owner).get(ownedChannelId);
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
