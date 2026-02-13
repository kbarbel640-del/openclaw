/**
 * Tests for TokenAccumulator.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TokenAccumulator } from '../../../src/streaming/pipeline/token-accumulator.js';
import type { StreamConfig } from '../../../src/streaming/pipeline/types.js';
import type { Timer } from '../../../src/core/types/timer.js';

describe('TokenAccumulator', () => {
  let accumulator: TokenAccumulator;
  let mockTimer: Timer;
  let currentTime: number;

  const config: StreamConfig = {
    flushTokenThreshold: 10, // ~40 characters
    flushTimeoutMs: 1000,
    maxMessageLength: 4096,
    typingIndicatorIntervalMs: 4000,
  };

  beforeEach(() => {
    currentTime = Date.now();
    mockTimer = {
      now: vi.fn(() => currentTime),
      setTimeout: vi.fn((callback, ms) => {
        return setTimeout(callback, ms);
      }) as any,
      clearTimeout: vi.fn((handle) => {
        clearTimeout(handle);
      }),
    };

    accumulator = new TokenAccumulator(config, mockTimer);
  });

  it('should return undefined before threshold', () => {
    const result = accumulator.accumulate('Short text');

    expect(result).toBeUndefined();
    expect(accumulator.hasContent()).toBe(true);
  });

  it('should return FlushResult at threshold', () => {
    // Add enough text to hit threshold (~40 chars = 10 tokens)
    const longText = 'a'.repeat(40);
    const result = accumulator.accumulate(longText);

    expect(result).toBeDefined();
    if (result) {
      expect(result.reason).toBe('token_count');
      expect(result.text).toBe(longText);
      expect(result.tokenCount).toBeGreaterThanOrEqual(10);
    }
  });

  it('should accumulate text before threshold', () => {
    accumulator.accumulate('Hello ');
    accumulator.accumulate('world');

    const result = accumulator.flush('done');

    expect(result.text).toBe('Hello world');
  });

  it('should flush with "done" reason on explicit flush', () => {
    accumulator.accumulate('Some text');
    const result = accumulator.flush('done');

    expect(result.reason).toBe('done');
    expect(result.text).toBe('Some text');
  });

  it('should clear buffer after flush', () => {
    accumulator.accumulate('Some text');
    accumulator.flush('done');

    expect(accumulator.hasContent()).toBe(false);
  });

  it('should handle multiple accumulate-flush cycles', () => {
    accumulator.accumulate('First');
    const result1 = accumulator.flush('done');
    expect(result1.text).toBe('First');

    accumulator.accumulate('Second');
    const result2 = accumulator.flush('done');
    expect(result2.text).toBe('Second');
  });

  it('should check timeout correctly', () => {
    accumulator.accumulate('Some text');

    // Before timeout
    let result = accumulator.checkTimeout();
    expect(result).toBeUndefined();

    // Advance time past timeout
    currentTime += config.flushTimeoutMs + 100;
    result = accumulator.checkTimeout();

    expect(result).toBeDefined();
    if (result) {
      expect(result.reason).toBe('timeout');
      expect(result.text).toBe('Some text');
    }
  });

  it('should return undefined for timeout check on empty buffer', () => {
    currentTime += config.flushTimeoutMs + 100;
    const result = accumulator.checkTimeout();

    expect(result).toBeUndefined();
  });

  it('should track token count accurately', () => {
    const text = 'a'.repeat(20); // ~5 tokens
    accumulator.accumulate(text);

    const result = accumulator.flush('done');
    expect(result.tokenCount).toBe(5);
  });

  it('should reset token count after flush', () => {
    accumulator.accumulate('a'.repeat(40));
    accumulator.flush('done');

    accumulator.accumulate('Short');
    const result = accumulator.flush('done');

    expect(result.tokenCount).toBeLessThan(10);
  });

  it('should handle empty flush', () => {
    const result = accumulator.flush('done');

    expect(result.text).toBe('');
    expect(result.tokenCount).toBe(0);
  });
});
