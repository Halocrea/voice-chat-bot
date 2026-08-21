import { Client } from 'discord.js';
import { getGuildIdsWithHubs, removeAllHubs } from '../models/VoiceHub';
import { logger } from './logger';

/**
 * Refuses to act when more than this share of the known guilds look missing.
 * Losing a third of them to churn is believable; losing most of them at once is
 * the signature of a partial guild list, not of servers actually leaving.
 */
const MAX_SHARE_REMOVABLE = 0.5;

/**
 * Drops the sectors of guilds the bot is no longer in.
 *
 * Nothing ever cleaned up after a removal, so the table has been drifting since
 * 2020: it accumulated every guild that ever finished its setup, including
 * those that removed the bot years ago. `guildDelete` now keeps it honest going
 * forward; this catches up on the backlog.
 *
 * Must run once the client is ready, since it reads the guild cache — which is
 * only complete after Discord has sent the full list.
 */
export function reconcileHubs(client: Client<true>) {
  const knownGuildIds = getGuildIdsWithHubs();
  if (!knownGuildIds.length) return;

  const orphans = knownGuildIds.filter((id) => !client.guilds.cache.has(id));
  if (!orphans.length) {
    logger.info(
      `Sectors reconciled: ${knownGuildIds.length} guild(s) known, all still present`,
    );
    return;
  }

  if (orphans.length > knownGuildIds.length * MAX_SHARE_REMOVABLE) {
    logger.warn(
      `Refusing to reconcile: ${orphans.length} of ${knownGuildIds.length} known guilds look missing, ` +
        `which is more likely an incomplete guild list than real churn. Nothing was removed.`,
    );
    return;
  }

  let removed = 0;
  for (const guildId of orphans) removed += removeAllHubs(guildId);

  logger.info(
    `Sectors reconciled: dropped ${removed} sector(s) from ${orphans.length} guild(s) the bot is no longer in, ` +
      `${knownGuildIds.length - orphans.length} guild(s) still active`,
  );
}
