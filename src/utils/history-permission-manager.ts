import Database from 'better-sqlite3';
import path from 'path';
import { HistoryPermission } from '../models/history-permission.model';

const db = new Database(
  path.join(__dirname, '../../saves/history_permission.db'),
  {
    verbose: console.log,
  }
);

const createHistoryPermissions = `CREATE TABLE IF NOT EXISTS History_permissions (
  userId VARCHAR(30) NOT NULL,
  permittedUserId VARCHAR(30) NOT NULL
);`;
db.exec(createHistoryPermissions);

export function getAllHistoryPermissions(
  userId: string
): { permittedUserId: string }[] {
  const historyPermissions =
    'SELECT permittedUserId FROM History_permissions WHERE userId = ?';
  return db.prepare(historyPermissions).all(userId);
}

export function addHistoryPermission(historyPermission: HistoryPermission) {
  const newHistoryPermission =
    'INSERT INTO History_permissions (userId, permittedUserId) VALUES (@userId, @permittedUserId)';
  db.prepare(newHistoryPermission).run(historyPermission);
}

export function deleteOneHistoryPermission(
  historyPermission: HistoryPermission
) {
  const deleteHistoryPermission =
    'DELETE FROM History_permissions WHERE userId = ? AND permittedUserId = ?';
  db.prepare(deleteHistoryPermission).run([
    historyPermission.userId,
    historyPermission.permittedUserId,
  ]);
}

export function deleteAllHistoryPermissions(userId: string) {
  const deleteHistoryPermissions =
    'DELETE FROM History_permissions WHERE userId = ?';
  db.prepare(deleteHistoryPermissions).run(userId);
}
