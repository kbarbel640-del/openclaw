/**
 * Interface for subprocess management.
 * Allows dependency injection for testing and different worker implementations.
 */

/**
 * Configuration for creating a subprocess.
 */
export interface SubprocessConfig {
  readonly id: string;
  readonly timeoutMs: number;
  readonly memoryLimitMb: number;
}

/**
 * Information about a created subprocess.
 */
export interface SubprocessInfo {
  readonly pid: number;
  readonly id: string;
}

/**
 * Factory interface for creating and managing subprocess workers.
 * Implementations can use Node.js child_process, worker_threads, or other mechanisms.
 */
export interface ISubprocessFactory {
  /**
   * Creates a new subprocess with the given configuration.
   */
  create(config: SubprocessConfig): Promise<SubprocessInfo>;

  /**
   * Gets current memory usage for a subprocess.
   * @returns Memory usage in megabytes, or undefined if process not found.
   */
  getMemoryUsage(pid: number): Promise<number | undefined>;

  /**
   * Kills a subprocess by PID.
   */
  kill(pid: number): Promise<void>;
}
