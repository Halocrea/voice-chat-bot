import { openDatabase } from './db';
import { moderationRoleMigrations } from './migrations';

const db = openDatabase('moderation_role.db', moderationRoleMigrations);

export interface ModerationRole {
  guildId: string;
  roleId: string;
}

export function getAllModerationRoles(guildId: string): { roleId: string }[] {
  const moderationRoles =
    'SELECT roleId FROM moderation_role WHERE guildId = ?';
  return db.prepare<[string], { roleId: string }>(moderationRoles).all(guildId);
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
