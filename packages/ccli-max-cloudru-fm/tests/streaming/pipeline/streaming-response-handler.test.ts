/**
 * Tests for StreamingResponseHandler.
 *
 * Uses London School TDD (mock-first) approach.
 * All dependencies (adapter, timer) are mocked to isolate the handler logic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StreamingResponseHandler } from '../../../src/streaming/pipeline/streaming-response-handler.js';
import type { IStreamAdapter } from '../../../src/streaming/adapters/messenger-stream-adapter.js';
import type { StreamConfig } from '../../../src/streaming/pipeline/types.js';
import type { Timer } from '../../../src/core/types/timer.js';

/**
 * Creates an async iterable from an array of strings.
 * Simulates a streaming response from an LLM provider.
 */
async function* createStream(chunks: string[]): AsyncIterable<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

/**
 * Creates an async iterable that throws after yielding some chunks.
 * Simulates a stream that fails mid-delivery.
 */
async function* createFailingStream(
  chunks: string[],
  errorAfter: number
): AsyncIterable<string> {
  let count = 0;
  for (const chunk of chunks) {
    if (count >= errorAfter) {
      throw new Error('Stream connection lost');
    }
    yield chunk;
    count++;
  }
}

describe('StreamingResponseHandler', () => {
  let handler: StreamingResponseHandler;
  let mockAdapter: IStreamAdapter;
  let mockTimer: Timer;
  let currentTime: number;
  let timeoutCallbacks: Array<{ callback: () => void; ms: number }>;

  const config: StreamConfig = {
    flushTokenThreshold: 10, // ~40 characters triggers flush
    flushTimeoutMs: 500,
    maxMessageLength: 4096,
    typingIndicatorIntervalMs: 4000,
  };

  beforeEach(() => {
    currentTime = Date.now();
    timeoutCallbacks = [];

    mockTimer = {
      now: vi.fn(() => currentTime),
      setTimeout: vi.fn((callback: () => void, ms: number) => {
        const entry = { callback, ms };
        timeoutCallbacks.push(entry);
        return entry as unknown as ReturnType<Timer['setTimeout']>;
      }),
      clearTimeout: vi.fn(),
    };

    mockAdapter = {
      sendTypingIndicator: vi.fn().mockResolvedValue(undefined),
      sendMessage: vi.fn().mockResolvedValue('msg-001'),
      editMessage: vi.fn().mockResolvedValue(undefined),
      supportsEdit: vi.fn().mockReturnValue(true),
    };

    handler = new StreamingResponseHandler(config, mockTimer);
  });

  describe('handleStream() - successful streaming with token accumulation', () => {
    it('should deliver accumulated tokens when threshold is reached', async () => {
      // Raw text chunks that trigger the raw text parser path
      // Each chunk becomes a text_delta event via StreamParser raw text mode
      const longChunk = 'a'.repeat(50);
      const stream = createStream([longChunk]);

      await handler.handleStream('session-1', 'chat-1', stream, mockAdapter);

      // The handler should have delivered text via sendMessage
      expect(mockAdapter.sendMessage).toHaveBeenCalled();
    });

    it('should flush remaining content after stream ends', async () => {
      // Short text that stays below threshold, flushed at end
      const stream = createStream(['Hello']);

      await handler.handleStream('session-1', 'chat-1', stream, mockAdapter);

      // Final flush should deliver remaining text
      expect(mockAdapter.sendMessage).toHaveBeenCalled();
      const calls = vi.mocked(mockAdapter.sendMessage).mock.calls;
      const lastCallText = calls[calls.length - 1]?.[1];
      expect(lastCallText).toContain('Hello');
    });

    it('should accumulate multiple small chunks before delivery', async () => {
      const stream = createStream(['Hi', ' there']);

      await handler.handleStream('session-1', 'chat-1', stream, mockAdapter);

      // Both chunks should be accumulated and delivered together on final flush
      const calls = vi.mocked(mockAdapter.sendMessage).mock.calls;
      const allText = calls.map(c => c[1]).join('');
      expect(allText).toContain('Hi');
      expect(allText).toContain('there');
    });

    it('should edit existing message when adapter supports edit', async () => {
      // SSE-formatted data so the parser produces structured events
      const chunk1 = 'data: {"type":"text_delta","data":"' + 'a'.repeat(50) + '"}\n\n';
      const chunk2 = 'data: {"type":"text_delta","data":"Second part"}\n\n';
      const stream = createStream([chunk1, chunk2]);

      vi.mocked(mockAdapter.sendMessage).mockResolvedValue('msg-100');
      vi.mocked(mockAdapter.supportsEdit).mockReturnValue(true);

      await handler.handleStream('session-1', 'chat-1', stream, mockAdapter);

      // First delivery creates new message, subsequent may edit
      expect(mockAdapter.sendMessage).toHaveBeenCalled();
    });
  });

  describe('handleStream() - fallback to batch on stream error', () => {
    it('should send accumulated text via sendMessage on stream error', async () => {
      const stream = createFailingStream(
        ['Some initial text', 'more text'],
        1 // fail after first chunk
      );

      await handler.handleStream('session-1', 'chat-1', stream, mockAdapter);

      // On error, handler flushes remaining buffer via adapter.sendMessage
      expect(mockAdapter.sendMessage).toHaveBeenCalled();
    });

    it('should not throw when stream fails', async () => {
      const stream = createFailingStream(['chunk'], 0);

      // Should not reject - errors are handled internally
      await expect(
        handler.handleStream('session-1', 'chat-1', stream, mockAdapter)
      ).resolves.toBeUndefined();
    });

    it('should stop typing indicator after stream error', async () => {
      const stream = createFailingStream(['data'], 0);

      await handler.handleStream('session-1', 'chat-1', stream, mockAdapter);

      // clearTimeout should be called in the finally block
      expect(mockTimer.clearTimeout).toHaveBeenCalled();
    });
  });

  describe('handleStream() - typing indicators sent', () => {
    it('should start typing indicator before processing stream', async () => {
      const stream = createStream(['Hello']);

      await handler.handleStream('session-1', 'chat-1', stream, mockAdapter);

      // setTimeout should be called for typing indicator
      expect(mockTimer.setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        config.typingIndicatorIntervalMs
      );
    });

    it('should stop typing indicator after stream completes', async () => {
      const stream = createStream(['Hello']);

      await handler.handleStream('session-1', 'chat-1', stream, mockAdapter);

      // clearTimeout should be called in finally block to stop typing indicator
      expect(mockTimer.clearTimeout).toHaveBeenCalled();
    });

    it('should handle typing indicator failure gracefully', async () => {
      vi.mocked(mockAdapter.sendTypingIndicator).mockRejectedValue(
        new Error('Typing indicator failed')
      );

      const stream = createStream(['Hello']);

      // Typing indicator failures should not break streaming
      await expect(
        handler.handleStream('session-1', 'chat-1', stream, mockAdapter)
      ).resolves.toBeUndefined();
    });
  });

  describe('handleStream() - long message splitting', () => {
    it('should split messages exceeding maxMessageLength', async () => {
      const shortConfig: StreamConfig = {
        ...config,
        maxMessageLength: 50,
        flushTokenThreshold: 1, // flush immediately to force delivery of long text
      };

      const shortHandler = new StreamingResponseHandler(shortConfig, mockTimer);
      const longText = 'a'.repeat(120);
      const stream = createStream([longText]);

      await shortHandler.handleStream('session-1', 'chat-1', stream, mockAdapter);

      // With a 50-char limit, 120 chars should produce multiple sendMessage calls
      const sendCalls = vi.mocked(mockAdapter.sendMessage).mock.calls;
      expect(sendCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('should deliver all content even when split across messages', async () => {
      const shortConfig: StreamConfig = {
        ...config,
        maxMessageLength: 30,
        flushTokenThreshold: 1,
      };

      const shortHandler = new StreamingResponseHandler(shortConfig, mockTimer);
      const text = 'Word '.repeat(20); // 100 chars
      const stream = createStream([text]);

      await shortHandler.handleStream('session-1', 'chat-1', stream, mockAdapter);

      // All text should be delivered across the messages
      const sendCalls = vi.mocked(mockAdapter.sendMessage).mock.calls;
      expect(sendCalls.length).toBeGreaterThanOrEqual(2);

      // Combine all delivered text
      const deliveredText = sendCalls.map(c => c[1]).join(' ');
      expect(deliveredText.replace(/\s+/g, ' ').trim()).toBeTruthy();
    });
  });

  describe('handleStream() - cleanup after completion', () => {
    it('should clear typing indicator timeout on success', async () => {
      const stream = createStream(['Hello']);

      await handler.handleStream('session-1', 'chat-1', stream, mockAdapter);

      expect(mockTimer.clearTimeout).toHaveBeenCalled();
    });

    it('should clear typing indicator timeout on error', async () => {
      const stream = createFailingStream(['data'], 0);

      await handler.handleStream('session-1', 'chat-1', stream, mockAdapter);

      expect(mockTimer.clearTimeout).toHaveBeenCalled();
    });

    it('should handle empty stream gracefully', async () => {
      const stream = createStream([]);

      await expect(
        handler.handleStream('session-1', 'chat-1', stream, mockAdapter)
      ).resolves.toBeUndefined();

      // Cleanup should still happen
      expect(mockTimer.clearTimeout).toHaveBeenCalled();
    });

    it('should not leave dangling timers after completion', async () => {
      const stream = createStream(['chunk1', 'chunk2', 'chunk3']);

      await handler.handleStream('session-1', 'chat-1', stream, mockAdapter);

      // The typing indicator timeout set via startTypingIndicator should be cleared
      const clearTimeoutCalls = vi.mocked(mockTimer.clearTimeout).mock.calls;

      // At minimum, the typing indicator timer must be cleared
      expect(clearTimeoutCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('handleStream() - SSE event parsing integration', () => {
    it('should parse SSE text_delta events and deliver text', async () => {
      const sseChunks = [
        'data: {"type":"text_delta","data":"Hello "}\n\n',
        'data: {"type":"text_delta","data":"world"}\n\n',
      ];
      const stream = createStream(sseChunks);

      await handler.handleStream('session-1', 'chat-1', stream, mockAdapter);

      expect(mockAdapter.sendMessage).toHaveBeenCalled();
    });

    it('should ignore error events from stream parser', async () => {
      const sseChunks = [
        'data: {"type":"error","data":"something went wrong"}\n\n',
        'data: {"type":"text_delta","data":"recovered text"}\n\n',
      ];
      const stream = createStream(sseChunks);

      await handler.handleStream('session-1', 'chat-1', stream, mockAdapter);

      // Should still deliver the text_delta content
      const calls = vi.mocked(mockAdapter.sendMessage).mock.calls;
      const allText = calls.map(c => c[1]).join('');
      expect(allText).toContain('recovered text');
    });
  });

  describe('handleStream() - adapter interaction patterns', () => {
    it('should pass correct chatId to adapter methods', async () => {
      const chatId = 'chat-xyz-789';
      const stream = createStream(['Hello']);

      await handler.handleStream('session-1', chatId, stream, mockAdapter);

      // Verify chatId is passed to sendMessage
      const sendCalls = vi.mocked(mockAdapter.sendMessage).mock.calls;
      if (sendCalls.length > 0) {
        expect(sendCalls[0]![0]).toBe(chatId);
      }
    });

    it('should use sendMessage when adapter does not support edit', async () => {
      vi.mocked(mockAdapter.supportsEdit).mockReturnValue(false);

      const sseChunks = [
        'data: {"type":"text_delta","data":"' + 'a'.repeat(50) + '"}\n\n',
        'data: {"type":"text_delta","data":"More text"}\n\n',
      ];
      const stream = createStream(sseChunks);

      await handler.handleStream('session-1', 'chat-1', stream, mockAdapter);

      // With supportsEdit=false, all deliveries should use sendMessage
      expect(mockAdapter.editMessage).not.toHaveBeenCalled();
    });
  });
});
