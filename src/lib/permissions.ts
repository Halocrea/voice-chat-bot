import { GuildMember, PermissionFlagsBits } from 'discord.js';
import { getAllModerationRoles } from '../models/ModerationRoles';

export function isMaintainer(userId: string): boolean {
  return !!process.env.MAINTAINER_ID && process.env.MAINTAINER_ID === userId;
}

export function isAdmin(member: GuildMember): boolean {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

export function isModerator(member: GuildMember): boolean {
  const moderationRoles = getAllModerationRoles(member.guild.id).map(
    (role) => role.roleId,
  );
  return member.roles.cache.some((role) => moderationRoles.includes(role.id));
}

/**
 * Discord's own command permissions decide who may *run* a command; this
 * decides who may act on a channel they don't own. That's business logic, so it
 * can't be delegated to the platform.
 */
export function canBypassOwnership(member: GuildMember): boolean {
  return isMaintainer(member.id) || isAdmin(member) || isModerator(member);
}

/** Moderators and administrators can't be kicked out of a channel */
export function isProtectedFromRejection(member: GuildMember): boolean {
  return isAdmin(member) || isModerator(member);
}
