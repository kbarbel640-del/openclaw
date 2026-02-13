/**
 * Token accumulator for buffering and flushing text based on configured rules.
 * Flushes when token count threshold is reached, timeout elapsed, or explicit flush requested.
 */

import type { Timer } from '../../core/types/timer.js';
import type { FlushResult, StreamConfig } from './types.js';

/**
 * Accumulates tokens and flushes based on count, timeout, or explicit request.
 */
export class TokenAccumulator {
  private buffer = '';
  private tokenCount = 0;
  private lastAccumulateTime = 0;
  private timeoutHandle?: ReturnType<Timer['setTimeout']>;

  constructor(
    private readonly config: StreamConfig,
    private readonly timer: Timer
  ) {
    this.lastAccumulateTime = timer.now();
  }

  /**
   * Accumulate text into the buffer.
   * @param text - Text to add to buffer
   * @returns FlushResult if buffer should be flushed, undefined otherwise
   */
  accumulate(text: string): FlushResult | undefined {
    this.buffer += text;
    this.tokenCount += this.estimateTokens(text);
    this.lastAccumulateTime = this.timer.now();

    // Clear existing timeout
    if (this.timeoutHandle) {
      this.timer.clearTimeout(this.timeoutHandle);
    }

    // Check if we should flush due to token count
    if (this.tokenCount >= this.config.flushTokenThreshold) {
      return this.flush('token_count');
    }

    // Set timeout for idle flush
    this.timeoutHandle = this.timer.setTimeout(() => {
      // Timeout callback will be handled externally
    }, this.config.flushTimeoutMs);

    return undefined;
  }

  /**
   * Check if the buffer should be flushed due to timeout.
   * @returns FlushResult if timeout expired, undefined otherwise
   */
  checkTimeout(): FlushResult | undefined {
    const elapsed = this.timer.now() - this.lastAccumulateTime;
    if (this.buffer.length > 0 && elapsed >= this.config.flushTimeoutMs) {
      return this.flush('timeout');
    }
    return undefined;
  }

  /**
   * Force flush the current buffer.
   * @param reason - Optional reason for the flush (defaults to 'done')
   * @returns FlushResult with current buffer contents
   */
  flush(reason: FlushResult['reason'] = 'done'): FlushResult {
    if (this.timeoutHandle) {
      this.timer.clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }

    const result: FlushResult = {
      text: this.buffer,
      reason,
      tokenCount: this.tokenCount,
    };

    this.buffer = '';
    this.tokenCount = 0;
    this.lastAccumulateTime = this.timer.now();

    return result;
  }

  /**
   * Estimate token count from text (rough approximation).
   * Uses simple heuristic: ~4 characters per token.
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if buffer has content.
   */
  hasContent(): boolean {
    return this.buffer.length > 0;
  }
}
