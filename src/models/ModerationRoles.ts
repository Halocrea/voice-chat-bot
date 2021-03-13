import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, '../../saves/moderation_role.db'));

const createModerationRole = `CREATE TABLE IF NOT EXISTS moderation_role (
  guildId VARCHAR(30) NOT NULL,
  roleId VARCHAR(30) NOT NULL
);`;
db.exec(createModerationRole);

export interface ModerationRole {
  guildId: string;
  roleId: string;
}

export function getAllModerationRoles(guildId: string): { roleId: string }[] {
  const moderationRoles =
    'SELECT roleId FROM moderation_role WHERE guildId = ?';
  return db.prepare(moderationRoles).all(guildId);
}

export function addModerationRole(moderationRole: ModerationRole) {
  const newModerationRole =
    'INSERT INTO moderation_role (guildId, roleId) VALUES (@guildId, @roleId)';
  db.prepare(newModerationRole).run(moderationRole);
}

export function deleteOneModerationRole(moderationRole: ModerationRole) {
  const deleteModerationRole =
    'DELETE FROM moderation_role WHERE guildId = ? AND roleId = ?';
  db.prepare(deleteModerationRole).run([
    moderationRole.guildId,
    moderationRole.roleId,
  ]);
}

export function deleteAllModerationRoles(guildId: string) {
  const deleteModerationRoles = 'DELETE FROM moderation_role WHERE guildId = ?';
  db.prepare(deleteModerationRoles).run(guildId);
}
