import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  Guild,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import './lib/env';
import { describeThrown, logger } from './lib/logger';

/**
 * Posts a one-off announcement to every guild the bot is in.
 *
 * Run by hand, never by the bot itself: a broadcast that could fire on its own
 * is a broadcast that will eventually fire twice. Sending is off unless --send
 * is passed, so the default outcome of running this by accident is a printed
 * plan and nothing else.
 *
 *   npm run announce           # dry run, shows what it would do
 *   npm run announce -- --send # actually posts
 */

const DISCORD_MESSAGE_LIMIT = 2000;

/** Spacing between posts. Politeness more than necessity — discord.js queues
 *  its own rate limits — but a burst across dozens of guilds deserves a pause. */
const DELAY_BETWEEN_SENDS_MS = 1_500;

/** Guilds keep arriving after `ready`; judging the list too early misses some */
const SETTLE_DELAY_MS = 30_000;

const ANNOUNCEMENT_FILE = path.join(__dirname, '../announcement.md');
const SENT_RECORD_FILE = path.join(__dirname, '../saves/announced.json');

const shouldSend = process.argv.includes('--send');

function loadAnnouncement(): string {
  let text: string;

  try {
    text = fs.readFileSync(ANNOUNCEMENT_FILE, 'utf8').trim();
  } catch {
    // Deliberately not versioned: an announcement belongs to the moment it is
    // sent, and has no business living in a repository other people fork
    throw new Error(
      `Nothing to announce — ${ANNOUNCEMENT_FILE} does not exist.\n` +
        `Write the message you want posted into that file, then run this again.`,
    );
  }

  if (!text) throw new Error(`${ANNOUNCEMENT_FILE} is empty`);
  if (text.length > DISCORD_MESSAGE_LIMIT) {
    throw new Error(
      `The announcement is ${text.length} characters, ${text.length - DISCORD_MESSAGE_LIMIT} over Discord's limit of ${DISCORD_MESSAGE_LIMIT}`,
    );
  }

  return text;
}

/**
 * Guilds already posted to, so an interrupted run can be resumed without
 * spamming the servers it already reached.
 */
function loadAlreadySent(): Set<string> {
  try {
    return new Set<string>(
      JSON.parse(fs.readFileSync(SENT_RECORD_FILE, 'utf8')),
    );
  } catch {
    return new Set();
  }
}

function rememberSent(sent: Set<string>) {
  fs.writeFileSync(SENT_RECORD_FILE, JSON.stringify([...sent], null, 2));
}

/**
 * Where the announcement belongs, best first.
 *
 * The system channel is where Discord itself posts about the server, so it is
 * the least intrusive place for a notice. Failing that, the topmost channel the
 * bot may write in — channel order roughly follows importance.
 */
function pickChannel(guild: Guild): TextChannel | undefined {
  const me = guild.members.me;
  if (!me) return undefined;

  const canPostIn = (channel: TextChannel) =>
    channel
      .permissionsFor(me)
      .has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]);

  if (guild.systemChannel && canPostIn(guild.systemChannel)) {
    return guild.systemChannel;
  }

  return guild.channels.cache
    .filter(
      (channel): channel is TextChannel =>
        channel.type === ChannelType.GuildText && canPostIn(channel),
    )
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .first();
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(client: Client<true>, announcement: string) {
  const alreadySent = loadAlreadySent();

  logger.info(
    `Letting the guild list settle for ${SETTLE_DELAY_MS / 1000}s before deciding anything`,
  );
  await wait(SETTLE_DELAY_MS);

  const guilds = [...client.guilds.cache.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  logger.info(
    `${guilds.length} guild(s) found, ${alreadySent.size} already announced to`,
  );
  logger.info(
    shouldSend
      ? '--send given: messages WILL be posted'
      : 'Dry run: nothing will be posted. Pass --send to post for real.',
  );
  console.log();

  let posted = 0;
  let skipped = 0;
  let unreachable = 0;

  for (const guild of guilds) {
    if (alreadySent.has(guild.id)) {
      console.log(`  skip     ${guild.name} — already announced to`);
      skipped++;
      continue;
    }

    const channel = pickChannel(guild);
    if (!channel) {
      console.log(`  NO PLACE ${guild.name} — no channel I may write in`);
      unreachable++;
      continue;
    }

    if (!shouldSend) {
      console.log(`  would    ${guild.name} -> #${channel.name}`);
      continue;
    }

    try {
      await channel.send(announcement);
      alreadySent.add(guild.id);
      rememberSent(alreadySent);
      console.log(`  sent     ${guild.name} -> #${channel.name}`);
      posted++;
    } catch (error) {
      console.log(`  FAILED   ${guild.name} -> #${channel.name}`);
      logger.warn(`Could not announce in ${guild.name}`, {
        err: describeThrown(error),
        guildId: guild.id,
      });
      unreachable++;
    }

    await wait(DELAY_BETWEEN_SENDS_MS);
  }

  console.log();
  logger.info(
    shouldSend
      ? `Done: ${posted} posted, ${skipped} skipped, ${unreachable} unreachable`
      : `Dry run over: ${guilds.length - skipped - unreachable} would be posted to, ${skipped} skipped, ${unreachable} unreachable`,
  );
}

// Read and checked before touching the network: there is nothing to gain from
// connecting to Discord only to discover the message is missing or too long
let announcement: string;
try {
  announcement = loadAnnouncement();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (ready) => {
  try {
    await run(ready, announcement);
  } catch (error) {
    logger.error('Announcement run failed', { err: describeThrown(error) });
    process.exitCode = 1;
  } finally {
    await client.destroy();
  }
});

client.login(process.env.TOKEN);
