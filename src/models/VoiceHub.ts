import { openDatabase } from './db';
import { guildSetupMigrations } from './migrations';

const db = openDatabase('guild_setup.db', guildSetupMigrations);

export interface VoiceHub {
  /** Joining this channel generates a new voice channel. Identifies the hub. */
  creatingChannelId: string;
  guildId: string;
  categoryId: string;
}

/**
 * The hot path: called on every voice state change to tell whether the channel
 * someone just joined is a trigger. Hence the primary key lookup.
 */
export function getHubByCreatingChannel(
  creatingChannelId: string,
): VoiceHub | undefined {
  return db
    .prepare<[string], VoiceHub>(
      'SELECT * FROM voice_hub WHERE creatingChannelId = ?',
    )
    .get(creatingChannelId);
}

/** Whether the bot manages the channels living inside that category */
export function isManagedCategory(
  guildId: string,
  categoryId: string,
): boolean {
  return !!db
    .prepare<[string, string], { one: number }>(
      'SELECT 1 AS one FROM voice_hub WHERE guildId = ? AND categoryId = ? LIMIT 1',
    )
    .get(guildId, categoryId);
}

/** Every guild the bot still holds a sector for, however many */
export function getGuildIdsWithHubs(): string[] {
  return db
    .prepare<[], { guildId: string }>('SELECT DISTINCT guildId FROM voice_hub')
    .all()
    .map((row) => row.guildId);
}

export function getHubsForGuild(guildId: string): VoiceHub[] {
  return db
    .prepare<[string], VoiceHub>('SELECT * FROM voice_hub WHERE guildId = ?')
    .all(guildId);
}

export function addHub(hub: VoiceHub) {
  const upsert = `INSERT INTO voice_hub (creatingChannelId, guildId, categoryId)
    VALUES (@creatingChannelId, @guildId, @categoryId)
    ON CONFLICT(creatingChannelId) DO UPDATE SET
      guildId    = excluded.guildId,
      categoryId = excluded.categoryId`;
  db.prepare(upsert).run(hub);
}

/** The sector a category holds, if the bot manages it. At most one by design. */
export function getHubInCategory(
  guildId: string,
  categoryId: string,
): VoiceHub | undefined {
  return db
    .prepare<[string, string], VoiceHub>(
      'SELECT * FROM voice_hub WHERE guildId = ? AND categoryId = ?',
    )
    .get(guildId, categoryId);
}

/**
 * Stops managing a sector: the bot will no longer create channels in that
 * category, nor clean up the empty ones left there.
 *
 * Only the registration goes away — the channels themselves are left alone,
 * since people may still be talking in them.
 *
 * @returns `true` if a sector was removed, `false` if the bot managed none in
 * that category
 */
export function removeHubInCategory(
  guildId: string,
  categoryId: string,
): boolean {
  return (
    db
      .prepare('DELETE FROM voice_hub WHERE guildId = ? AND categoryId = ?')
      .run(guildId, categoryId).changes > 0
  );
}

/**
 * Wipes every sector of a guild in one go, leaving the bot with nothing to do
 * there until someone sets it up again. Backs `/voice-setup clear`, and is what
 * to call if the bot is ever kicked from a server. Channels are left untouched.
 *
 * @returns how many hubs were removed, `0` if the guild had none
 */
export function removeAllHubs(guildId: string): number {
  return db.prepare('DELETE FROM voice_hub WHERE guildId = ?').run(guildId)
    .changes;
}
