import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(
  path.join(__dirname, '../../saves/historic_permission.db'),
  {
    verbose: console.log,
  }
);

const createHistoricPermission = `CREATE TABLE IF NOT EXISTS historic_permission (
  userId VARCHAR(30) NOT NULL,
  permittedUserId VARCHAR(30) NOT NULL
);`;
db.exec(createHistoricPermission);

export interface HistoricPermission {
  userId: string;
  permittedUserId: string;
}

export function getAllHistoricPermissions(
  userId: string
): { permittedUserId: string }[] {
  const historicPermissions =
    'SELECT permittedUserId FROM historic_permission WHERE userId = ?';
  return db.prepare(historicPermissions).all(userId);
}

export function addHistoricPermission(historicPermission: HistoricPermission) {
  const newHistoricPermission =
    'INSERT INTO historic_permission (userId, permittedUserId) VALUES (@userId, @permittedUserId)';
  db.prepare(newHistoricPermission).run(historicPermission);
}

export function deleteOneHistoricPermission(
  historicPermission: HistoricPermission
) {
  const deleteHistoricPermission =
    'DELETE FROM historic_permission WHERE userId = ? AND permittedUserId = ?';
  db.prepare(deleteHistoricPermission).run([
    historicPermission.userId,
    historicPermission.permittedUserId,
  ]);
}

export function deleteAllHistoricPermissions(userId: string) {
  const deleteHistoricPermissions =
    'DELETE FROM historic_permission WHERE userId = ?';
  db.prepare(deleteHistoricPermissions).run(userId);
}
