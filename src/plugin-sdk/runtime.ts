import { format } from "node:util";
import type { RuntimeEnv } from "../runtime.js";

type LoggerLike = {
  info: (message: string) => void;
  error: (message: string) => void;
};

/**
 * @description Creates a {@link RuntimeEnv} implementation backed by a
 * structured logger. Log messages are formatted with Node's `util.format` so
 * they behave like `console.log`/`console.error` with multi-argument support.
 * Calling `exit()` throws an error (from `exitError` if supplied, otherwise a
 * generic `Error("exit <code>")`) rather than terminating the process, which
 * is appropriate in plugin and test contexts.
 *
 * @param params.logger - Logger with `info` and `error` methods (e.g. a
 *   pino/winston-compatible logger or the plugin's channel logger).
 * @param params.exitError - Optional factory for the error thrown by `exit()`.
 *   Receives the numeric exit code and should return an `Error` instance.
 * @returns A {@link RuntimeEnv} suitable for passing to channel plugins.
 *
 * @example
 * ```ts
 * const runtime = createLoggerBackedRuntime({ logger: myLogger });
 * setMyChannelRuntime(runtime);
 * ```
 */
export function createLoggerBackedRuntime(params: {
  logger: LoggerLike;
  exitError?: (code: number) => Error;
}): RuntimeEnv {
  return {
    log: (...args) => {
      params.logger.info(format(...args));
    },
    error: (...args) => {
      params.logger.error(format(...args));
    },
    exit: (code: number): never => {
      throw params.exitError?.(code) ?? new Error(`exit ${code}`);
    },
  };
}
