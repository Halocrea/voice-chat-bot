import * as dotenv from 'dotenv';

/**
 * Loads the .env, and must be imported by anything that reads `process.env`
 * while its own module body runs.
 *
 * ES imports are evaluated before the first statement of the module importing
 * them, so a `dotenv.config()` sitting at the top of index.ts still runs *after*
 * every module it imports has been built. Anything configured at import time —
 * the logger and its transports — would read an empty environment and silently
 * fall back to its defaults. Importing this module instead makes the load part
 * of the dependency graph, where the ordering is guaranteed.
 */
dotenv.config({ quiet: true });
