import { runCommandWithTimeout } from "../process/exec.js";

/**
 * @description The result of a plugin command invocation.
 */
export type PluginCommandRunResult = {
  /** Process exit code. Non-zero typically indicates an error. */
  code: number;
  /** Standard output captured from the process. */
  stdout: string;
  /**
   * Standard error captured from the process. When the command times out,
   * this field contains a timeout message if the process did not write to
   * stderr.
   */
  stderr: string;
};

/**
 * @description Options for running a plugin command via
 * {@link runPluginCommandWithTimeout}.
 */
export type PluginCommandRunOptions = {
  /** The command and its arguments as an array (e.g. `["ffmpeg", "-i", "input.mp4"]`). */
  argv: string[];
  /** Maximum time in milliseconds before the command is killed and an error is returned. */
  timeoutMs: number;
  /** Optional working directory for the spawned process. */
  cwd?: string;
  /** Optional environment variables for the spawned process. */
  env?: NodeJS.ProcessEnv;
};

/**
 * @description Runs an external command with a hard timeout and captures its
 * stdout/stderr. Never throws — errors (including timeouts and spawn
 * failures) are returned as non-zero exit codes with a descriptive `stderr`
 * message.
 *
 * @param options - Command, timeout, and environment options (see
 *   {@link PluginCommandRunOptions}).
 * @returns A promise resolving to a {@link PluginCommandRunResult} containing
 *   the exit code and captured output.
 *
 * @example
 * ```ts
 * const result = await runPluginCommandWithTimeout({
 *   argv: ["ffmpeg", "-i", inputPath, outputPath],
 *   timeoutMs: 30_000,
 * });
 * if (result.code !== 0) {
 *   throw new Error(`ffmpeg failed: ${result.stderr}`);
 * }
 * ```
 */
export async function runPluginCommandWithTimeout(
  options: PluginCommandRunOptions,
): Promise<PluginCommandRunResult> {
  const [command] = options.argv;
  if (!command) {
    return { code: 1, stdout: "", stderr: "command is required" };
  }

  try {
    const result = await runCommandWithTimeout(options.argv, {
      timeoutMs: options.timeoutMs,
      cwd: options.cwd,
      env: options.env,
    });
    const timedOut = result.termination === "timeout" || result.termination === "no-output-timeout";
    return {
      code: result.code ?? 1,
      stdout: result.stdout,
      stderr: timedOut
        ? result.stderr || `command timed out after ${options.timeoutMs}ms`
        : result.stderr,
    };
  } catch (error) {
    return {
      code: 1,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
    };
  }
}
