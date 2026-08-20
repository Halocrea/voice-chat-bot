import Transport from 'winston-transport';
// Type-only, so this does not close an import cycle with the logger at runtime
import type { LoggedError } from './logger';

/** What winston hands a transport: our fields plus its own symbols */
interface TransformableInfo {
  level: string;
  message: unknown;
  err?: LoggedError;
  guildId?: string | null;
  [key: string]: unknown;
}

/** Sends one webhook payload. Injectable so the throttling can be tested dry. */
export type AlertSender = (payload: unknown) => Promise<void>;

export interface DiscordAlertOptions {
  webhookUrl: string;
  send?: AlertSender;
  /** One alert per identical problem per window, then a summary */
  windowMs?: number;
  /** Hard ceiling whatever the variety of errors, to survive a storm */
  maxPerMinute?: number;
  /** Length of the ceiling window. Only ever overridden by the tests. */
  minuteMs?: number;
}

interface Repeat {
  /** Kept rather than re-derived: the fingerprint drops absent parts, so its
   *  segments are not at stable positions */
  label: string;
  count: number;
  since: number;
  timer: NodeJS.Timeout;
}

const RED = 0xed4245;
const GREY = 0x99aab5;
const MAX_STACK_CHARS = 900;

/**
 * Posts `error` logs to a Discord webhook.
 *
 * A webhook rather than the bot's own client, deliberately: the client shares
 * the fate of whatever broke it. Gateway down, token rejected, process on its
 * way out — a plain HTTPS call still goes through, and that is exactly when an
 * alert matters most.
 */
export class DiscordAlertTransport extends Transport {
  private readonly webhookUrl: string;
  private readonly send: AlertSender;
  private readonly windowMs: number;
  private readonly maxPerMinute: number;

  private readonly minuteMs: number;

  private readonly repeats = new Map<string, Repeat>();
  private minuteStartedAt = Date.now();
  private sentThisMinute = 0;
  private suppressedThisMinute = 0;
  private suppressionTimer?: NodeJS.Timeout;

  constructor(options: DiscordAlertOptions) {
    super({ level: 'error' });
    this.webhookUrl = options.webhookUrl;
    this.send =
      options.send ?? ((payload) => postWebhook(this.webhookUrl, payload));
    this.windowMs = options.windowMs ?? 5 * 60_000;
    this.maxPerMinute = options.maxPerMinute ?? 10;
    this.minuteMs = options.minuteMs ?? 60_000;
  }

  log(info: TransformableInfo, next: () => void) {
    setImmediate(() => this.emit('logged', info));

    // Never let this path throw. An alert that failed loudly would be logged,
    // which would alert, which would fail... the loop this whole thing exists
    // to prevent.
    void this.dispatch(info).catch(() => undefined);
    next();
  }

  private async dispatch(info: TransformableInfo) {
    const error = info.err as LoggedError | undefined;
    const fingerprint = [info.level, error?.name, error?.code, info.message]
      .filter(Boolean)
      .join('|');

    const repeat = this.repeats.get(fingerprint);
    if (repeat) {
      // Already reported inside the window; just remember it happened again
      repeat.count++;
      return;
    }

    this.repeats.set(fingerprint, {
      label: String(info.message),
      count: 0,
      since: Date.now(),
      // unref so a pending summary never keeps the process alive
      timer: setTimeout(() => this.flush(fingerprint), this.windowMs).unref(),
    });

    await this.deliver(alertPayload(info, error));
  }

  private flush(fingerprint: string) {
    const repeat = this.repeats.get(fingerprint);
    this.repeats.delete(fingerprint);
    if (!repeat?.count) return;

    void this.deliver(
      summaryPayload(repeat.label, repeat.count, repeat.since),
    ).catch(() => undefined);
  }

  private async deliver(payload: unknown) {
    this.rollMinute(Date.now());

    if (this.sentThisMinute >= this.maxPerMinute) {
      this.suppressedThisMinute++;
      this.scheduleSuppressionNotice();
      return;
    }

    this.sentThisMinute++;
    await this.send(payload);
  }

  /**
   * Guarantees the "N suppressed" notice arrives even if nothing is ever sent
   * again.
   *
   * `rollMinute` only runs when something tries to go out, so after a storm
   * followed by silence the notice would wait indefinitely — and you would
   * believe you had seen every alert.
   */
  private scheduleSuppressionNotice() {
    if (this.suppressionTimer) return;

    const untilNextMinute = Math.max(
      0,
      this.minuteMs - (Date.now() - this.minuteStartedAt),
    );
    this.suppressionTimer = setTimeout(() => {
      this.suppressionTimer = undefined;
      this.rollMinute(Date.now());
    }, untilNextMinute + 50);
    this.suppressionTimer.unref();
  }

  private rollMinute(now: number) {
    if (now - this.minuteStartedAt < this.minuteMs) return;

    this.clearSuppressionTimer();
    const startedAt = this.minuteStartedAt;
    this.minuteStartedAt = now;
    this.sentThisMinute = 0;

    if (this.suppressedThisMinute) {
      const suppressed = this.suppressedThisMinute;
      this.suppressedThisMinute = 0;
      // Bypasses the ceiling on purpose: this is the message that explains the
      // hole in the timeline
      void this.send(
        summaryPayload(
          'Alerts suppressed to keep this channel usable',
          suppressed,
          startedAt,
        ),
      ).catch(() => undefined);
    }
  }

  private clearSuppressionTimer() {
    if (!this.suppressionTimer) return;
    clearTimeout(this.suppressionTimer);
    this.suppressionTimer = undefined;
  }

  /** Winston calls this on shutdown; leave no timer behind */
  close() {
    for (const repeat of this.repeats.values()) clearTimeout(repeat.timer);
    this.repeats.clear();
    this.clearSuppressionTimer();
  }
}

function alertPayload(info: TransformableInfo, error: LoggedError | undefined) {
  const fields: { name: string; value: string; inline?: boolean }[] = [];

  if (error) {
    fields.push({
      name: error.name,
      value: truncate(error.message || '(no message)', 1000),
    });
  }
  if (error?.code !== undefined) {
    fields.push({
      name: 'Discord API',
      value: truncate(
        `code ${error.code}${error.status ? ` · HTTP ${error.status}` : ''}` +
          (error.method && error.url ? `\n${error.method} ${error.url}` : ''),
        1000,
      ),
      inline: true,
    });
  }
  if (info.guildId) {
    fields.push({ name: 'Guild', value: String(info.guildId), inline: true });
  }

  return {
    username: 'voice-chat-bot',
    embeds: [
      {
        title: `🚨 ${String(info.message)}`,
        description: error?.stack
          ? '```\n' + truncate(error.stack, MAX_STACK_CHARS) + '\n```'
          : undefined,
        color: RED,
        fields: fields.length ? fields : undefined,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

function summaryPayload(what: string, count: number, since: number) {
  return {
    username: 'voice-chat-bot',
    embeds: [
      {
        title: `🔁 ${truncate(what, 200)}`,
        description: `Happened **${count}** more time${count > 1 ? 's' : ''} since <t:${Math.floor(since / 1000)}:t>, not reported individually.`,
        color: GREY,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

async function postWebhook(url: string, payload: unknown): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    // A hanging webhook must not pile up requests forever
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    // console on purpose, never the logger: reporting a failed alert through
    // the thing that alerts is how you build an infinite loop. The URL is a
    // secret, so only the status is worth saying out loud.
    console.error(
      `[alerts] Discord refused the webhook call: HTTP ${response.status}`,
    );
  }
}
