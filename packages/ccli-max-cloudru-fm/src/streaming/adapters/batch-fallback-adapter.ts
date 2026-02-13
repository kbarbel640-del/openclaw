/**
 * Batch fallback adapter for platforms that don't support streaming.
 * Collects all text and sends as a single message at the end.
 */

import type { IStreamAdapter } from './messenger-stream-adapter.js';

/**
 * Simple adapter that batches all content and sends once at the end.
 * Used as fallback when streaming is not supported or fails.
 */
export class BatchFallbackAdapter implements IStreamAdapter {
  private accumulatedText = '';

  /**
   * No-op for batch mode - no typing indicators needed.
   */
  async sendTypingIndicator(_chatId: string): Promise<void> {
    // No-op in batch mode
  }

  /**
   * Accumulates text instead of sending immediately.
   */
  async sendMessage(_chatId: string, text: string): Promise<string> {
    this.accumulatedText += text;
    return 'batch-message-id';
  }

  /**
   * Not supported in batch mode - falls back to accumulation.
   */
  async editMessage(_chatId: string, _messageId: string, text: string): Promise<void> {
    this.accumulatedText += text;
  }

  /**
   * Batch mode does not support editing.
   */
  supportsEdit(): boolean {
    return false;
  }

  /**
   * Get all accumulated text and reset buffer.
   */
  getAccumulatedText(): string {
    const text = this.accumulatedText;
    this.accumulatedText = '';
    return text;
  }
}
