import { createSubsystemLogger } from "./subsystem.js";

const logger = createSubsystemLogger("swallowed");

/**
 * Log a swallowed error at debug level so it's visible in verbose mode
 * but not noisy in production. Use this instead of empty `catch {}` blocks.
 */
export function logSwallowed(context: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  logger.debug(`${context}: ${message}`);
}
