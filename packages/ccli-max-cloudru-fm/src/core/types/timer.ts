/**
 * Timer Interface
 * Injectable timer abstraction for testability and time control
 */

/**
 * Abstraction over time-based operations
 * Enables dependency injection of time-related functions for testing
 */
export interface Timer {
  /**
   * Returns the current timestamp in milliseconds since epoch
   */
  now(): number;

  /**
   * Schedules a callback to run after a specified delay
   * @param callback - Function to execute
   * @param ms - Delay in milliseconds
   * @returns Timer handle for cancellation
   */
  setTimeout(callback: () => void, ms: number): NodeJS.Timeout;

  /**
   * Cancels a scheduled timeout
   * @param handle - Timer handle from setTimeout
   */
  clearTimeout(handle: NodeJS.Timeout): void;
}

/**
 * Real timer implementation using Node.js built-ins
 * Use this in production code
 */
export const realTimer: Timer = {
  now: () => Date.now(),
  setTimeout: (cb, ms) => setTimeout(cb, ms),
  clearTimeout: (h) => clearTimeout(h),
};
