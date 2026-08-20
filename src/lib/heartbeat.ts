import { Client } from 'discord.js';
import { describeThrown, logger } from './logger';

const DEFAULT_INTERVAL_MINUTES = 5;

/**
 * Pings an external dead man's switch at a regular interval.
 *
 * This is the half of supervision the alerts cannot cover: alerts only report
 * failures the bot *survived*, and a dead process sends nothing at all. Here it
 * is the **silence** that raises the alarm, on a service that lives outside this
 * machine entirely.
 *
 * The bot pushes rather than being polled, deliberately: an inbound health
 * check would need a reachable address and an open port, which a self-hosted
 * instance behind NAT rarely has. An outbound call needs neither.
 *
 * @returns a function to stop beating
 */
export function startHeartbeat(
  client: Client,
  url = process.env.HEARTBEAT_URL,
): () => void {
  if (!url) {
    logger.info("HEARTBEAT_URL is not set: the dead man's switch is off");
    return () => undefined;
  }

  const minutes =
    Number(process.env.HEARTBEAT_INTERVAL_MINUTES) || DEFAULT_INTERVAL_MINUTES;

  const beat = async () => {
    // A beat driven by the timer alone would only prove that Node is running.
    // With the gateway down the process is alive and the bot completely deaf —
    // which is precisely the failure this exists to catch — so a beat has to
    // mean "connected", not "not crashed".
    if (!client.isReady()) {
      logger.warn('Skipping heartbeat: the Discord gateway is not ready');
      return;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) {
        logger.warn(`Heartbeat refused: HTTP ${response.status}`);
      }
    } catch (error) {
      // One missed beat is not an outage: the monitor's grace period exists to
      // absorb exactly this. Worth a line, not an alert.
      logger.warn('Could not send the heartbeat', {
        err: describeThrown(error),
      });
    }
  };

  void beat();
  const timer = setInterval(() => void beat(), minutes * 60_000);
  // The Discord client is what keeps the process alive; this must not
  timer.unref();

  logger.info(`Heartbeat started, every ${minutes} minute(s)`);
  return () => clearInterval(timer);
}
