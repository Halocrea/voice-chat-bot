// First, so the environment is loaded before the transports below are built
import './env';

import winston from 'winston';
import { DiscordAlertTransport } from './discord-alert-transport';

const { colorize, combine, printf, timestamp } = winston.format;

/** Anything thrown, flattened into something every transport can render */
export interface LoggedError {
  name: string;
  message: string;
  stack?: string;
  /** Discord API errors carry these, and they are what makes them diagnosable */
  code?: string | number;
  status?: number;
  method?: string;
  url?: string;
}

export function describeThrown(error: unknown): LoggedError {
  if (!(error instanceof Error)) {
    return { name: 'Unknown', message: String(error) };
  }

  const { code, status, method, url } = error as Error & Partial<LoggedError>;
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(code !== undefined && { code }),
    ...(status !== undefined && { status }),
    ...(method !== undefined && { method }),
    ...(url !== undefined && { url }),
  };
}

/** Discord's "you haven't allowed me to do that on your server" family */
const PERMISSION_CODES = [50001, 50013];

export function isPermissionError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'number' && PERMISSION_CODES.includes(code);
}

/**
 * Which level a caught error deserves.
 *
 * A missing permission means an administrator has misconfigured *their* server:
 * they have already been told, and there is nothing for the maintainer to do.
 * Alerting on those would bury the alerts that do require action, and an alert
 * channel people learn to ignore is worse than no alert channel at all.
 */
export function levelFor(error: unknown): 'warn' | 'error' {
  return isPermissionError(error) ? 'warn' : 'error';
}

/** Rendered by the line builder below, everything else is context */
const OWN_FIELDS = new Set(['level', 'message', 'timestamp', 'err']);

/**
 * Turns the leftover fields into `key=value` pairs.
 *
 * Without this every piece of context a caller attaches — which guild, which
 * category, how many servers — is silently dropped on the floor, and the log
 * says less than the code believes it says.
 */
function contextOf(info: Record<string, unknown>): string {
  return Object.entries(info)
    .filter(([key, value]) => !OWN_FIELDS.has(key) && value !== undefined)
    .map(([key, value]) => {
      const rendered =
        typeof value === 'object' ? JSON.stringify(value) : String(value);
      return `${key}=${rendered}`;
    })
    .join(' ');
}

const consoleFormat = combine(
  colorize({ level: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf((info) => {
    const error = info.err as LoggedError | undefined;
    const context = contextOf(info);
    const line =
      `${info.timestamp} ${info.level} ${info.message}` +
      (context ? ` ${context}` : '');
    if (!error) return line;

    // "Missing Permissions" on its own never says what Discord refused, so the
    // code and the route it came from go on the first line, before the stack
    const route =
      error.method && error.url ? ` on ${error.method} ${error.url}` : '';
    const api =
      error.code === undefined
        ? ''
        : ` [${error.code}${error.status ? ` HTTP ${error.status}` : ''}${route}]`;

    return error.stack
      ? `${line}${api}\n${error.stack}`
      : `${line}${api} (${error.name}: ${error.message})`;
  }),
);

/**
 * The application logger.
 *
 * Nothing writes to a file here on purpose. Process managers already capture
 * stdout and stderr and rotate them, so persisting logs belongs to whichever
 * one is running the bot; doing it again from in here would duplicate the work
 * and, on flash storage, the wear that comes with it.
 *
 * Levels are chosen by asking "does a human have to act, and which one?":
 *   error — the maintainer must look at this. Alerted on.
 *   warn  — surmounted, or the server admin's problem. Not alerted on.
 *   info  — lifecycle worth seeing in the logs.
 *   debug — detail, off unless LOG_LEVEL says otherwise.
 */
const alertWebhookUrl = process.env.ALERT_WEBHOOK_URL;

/**
 * Winston's npm levels, most severe first. A level enables itself and every
 * level above it.
 */
const LEVELS = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];
const DEFAULT_LEVEL = 'info';

/**
 * An unknown level makes winston drop *everything*, errors included — and with
 * them the Discord alerts, which listen on `error`. A typo in the .env would
 * therefore switch the whole supervision off without a word, which is the one
 * failure this variable must never be able to cause.
 */
const requestedLevel = process.env.LOG_LEVEL;
const invalidLevel =
  requestedLevel && !LEVELS.includes(requestedLevel)
    ? requestedLevel
    : undefined;

export const logger = winston.createLogger({
  level: invalidLevel ? DEFAULT_LEVEL : (requestedLevel ?? DEFAULT_LEVEL),
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    // Registered only when configured, so a development machine stays quiet
    ...(alertWebhookUrl
      ? [new DiscordAlertTransport({ webhookUrl: alertWebhookUrl })]
      : []),
  ],
});

if (invalidLevel) {
  logger.warn(
    `LOG_LEVEL="${invalidLevel}" is not a known level, falling back to ${DEFAULT_LEVEL}. ` +
      `Valid values: ${LEVELS.join(', ')}`,
  );
}

if (!alertWebhookUrl) {
  logger.info('ALERT_WEBHOOK_URL is not set: Discord alerting is off');
}
