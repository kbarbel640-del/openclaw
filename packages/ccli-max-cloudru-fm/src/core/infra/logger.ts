/**
 * Structured logger for OpenClaw platform.
 * Wraps pino to provide consistent, structured logging across all modules.
 */
import pino from 'pino';

const rootLogger = pino({ name: 'openclaw' });

/**
 * Creates a child logger scoped to a specific module.
 * @param module - The module name for log context
 * @returns A pino child logger instance
 */
export function createLogger(module: string): pino.Logger {
  return rootLogger.child({ module });
}

export { rootLogger as logger };
