/**
 * Streaming response handler - orchestrates the entire streaming pipeline.
 * Coordinates parser, accumulator, splitter, and adapter to deliver smooth streaming.
 */

import type { Timer } from '../../core/types/timer.js';
import type { IStreamAdapter } from '../adapters/messenger-stream-adapter.js';
import type { StreamConfig } from './types.js';
import { StreamParser } from './stream-parser.js';
import { TokenAccumulator } from './token-accumulator.js';
import { LongMessageSplitter } from './long-message-splitter.js';

/**
 * Orchestrates the streaming response pipeline.
 * Handles parsing, buffering, splitting, and delivery of streaming responses.
 */
export class StreamingResponseHandler {
  private readonly parser = new StreamParser();
  private readonly splitter = new LongMessageSplitter();
  private typingIndicatorInterval?: ReturnType<Timer['setTimeout']>;

  constructor(
    private readonly config: StreamConfig,
    private readonly timer: Timer
  ) {}

  /**
   * Handle a streaming response from start to finish.
   * @param sessionId - Session identifier
   * @param chatId - Platform-specific chat identifier
   * @param stream - Async iterable of text chunks
   * @param adapter - Platform-specific stream adapter
   */
  async handleStream(
    _sessionId: string,
    chatId: string,
    stream: AsyncIterable<string>,
    adapter: IStreamAdapter
  ): Promise<void> {
    const accumulator = new TokenAccumulator(this.config, this.timer);
    let currentMessageId: string | undefined;

    // Start typing indicator
    this.startTypingIndicator(chatId, adapter);

    try {
      for await (const chunk of stream) {
        const events = this.parser.parse(chunk);

        for (const event of events) {
          if (event.type === 'text_delta' && event.data) {
            const flushResult = accumulator.accumulate(event.data);

            if (flushResult && flushResult.text) {
              currentMessageId = await this.deliverText(
                chatId,
                flushResult.text,
                currentMessageId,
                adapter
              );
            }
          } else if (event.type === 'error') {
            // Log error event - could be sent to structured logger
          }
        }
      }

      // Flush any remaining content
      const finalFlush = accumulator.flush('done');
      if (finalFlush.text) {
        await this.deliverText(
          chatId,
          finalFlush.text,
          currentMessageId,
          adapter
        );
      }
    } catch (error) {
      // Streaming error, fall back to batch mode
      // In production, this could be sent to structured logger
      const fallbackFlush = accumulator.flush('done');
      if (fallbackFlush.text) {
        await adapter.sendMessage(chatId, fallbackFlush.text);
      }
    } finally {
      this.stopTypingIndicator();
    }
  }

  /**
   * Deliver text to the platform, handling splitting and edit vs new message.
   */
  private async deliverText(
    chatId: string,
    text: string,
    currentMessageId: string | undefined,
    adapter: IStreamAdapter
  ): Promise<string> {
    const chunks = this.splitter.split(text, this.config.maxMessageLength);

    let messageId: string | undefined = currentMessageId;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      if (i === 0 && typeof messageId === 'string' && adapter.supportsEdit()) {
        // Edit existing message with first chunk
        await adapter.editMessage(chatId, messageId, chunk!);
      } else {
        // Send new message
        messageId = await adapter.sendMessage(chatId, chunk!);
      }
    }

    // Return the last message ID (guaranteed to exist after loop since chunks is non-empty)
    if (messageId === undefined) {
      throw new Error('Message ID should exist after delivering chunks');
    }
    return messageId;
  }

  /**
   * Start sending typing indicators at regular intervals.
   */
  private startTypingIndicator(chatId: string, adapter: IStreamAdapter): void {
    this.typingIndicatorInterval = this.timer.setTimeout(() => {
      adapter.sendTypingIndicator(chatId).catch(_err => {
        // Typing indicator failures are non-critical, ignore
      });
    }, this.config.typingIndicatorIntervalMs);
  }

  /**
   * Stop sending typing indicators.
   */
  private stopTypingIndicator(): void {
    if (this.typingIndicatorInterval) {
      this.timer.clearTimeout(this.typingIndicatorInterval);
      this.typingIndicatorInterval = undefined;
    }
  }
}
