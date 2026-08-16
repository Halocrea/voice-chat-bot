import {
  Guild,
  GuildMember,
  PermissionFlagsBits,
  PermissionsBitField,
} from 'discord.js';
import { getAllModerationRoles } from '../models/ModerationRoles';

/**
 * What the bot needs on the guild itself to do its job. Note that Discord also
 * refuses to let a bot *grant* a permission it doesn't hold, so creating the
 * category with these very permissions in its overwrites fails unless the bot
 * already has all of them — which is why a plain "Missing Permissions" can show
 * up on channel creation rather than on the action you'd expect.
 */
export const REQUIRED_PERMISSIONS = [
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.Connect,
  PermissionFlagsBits.MoveMembers,
];

/** Human-readable list of what the bot is still missing, empty when all good */
export function missingBotPermissions(guild: Guild): string[] {
  const me = guild.members.me;
  if (!me) return [];
  return REQUIRED_PERMISSIONS.filter(
    (permission) => !me.permissions.has(permission),
  ).flatMap((permission) => new PermissionsBitField(permission).toArray());
}

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
 * Guards the setup and moderation commands.
 *
 * This deliberately does *not* use Discord's `default_member_permissions`: when
 * Discord enforces the gate it refuses the interaction before the bot is ever
 * called, so a bypass the bot wants to grant could never fire. Keeping the check
 * here is what lets the maintainer configure a server they aren't admin of.
 */
export function canConfigureBot(member: GuildMember): boolean {
  return isAdmin(member) || isMaintainer(member.id);
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
