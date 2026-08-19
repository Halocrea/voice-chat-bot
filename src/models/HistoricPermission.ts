import { openDatabase } from './db';
import { historicPermissionMigrations } from './migrations';

const db = openDatabase('historic_permission.db', historicPermissionMigrations);

export interface HistoricPermission {
  userId: string;
  permittedUserId: string;
}

export function getAllHistoricPermissions(
  userId: string,
): { permittedUserId: string }[] {
  const historicPermissions =
    'SELECT permittedUserId FROM historic_permission WHERE userId = ?';
  return db
    .prepare<[string], { permittedUserId: string }>(historicPermissions)
    .all(userId);
}

export function addHistoricPermission(historicPermission: HistoricPermission) {
  const newHistoricPermission =
    'INSERT INTO historic_permission (userId, permittedUserId) VALUES (@userId, @permittedUserId)';
  db.prepare(newHistoricPermission).run(historicPermission);
}

export function deleteOneHistoricPermission(
  historicPermission: HistoricPermission,
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
