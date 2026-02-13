/**
 * SSE/JSON stream parser for handling various streaming formats.
 * Supports SSE format, JSON lines, and raw text chunks with graceful degradation.
 */

import type { StreamEvent } from './types.js';

/**
 * Parses streaming response chunks into structured StreamEvents.
 * Handles multiple formats with automatic fallback to raw text mode.
 */
export class StreamParser {
  private buffer = '';
  private isRawTextMode = false;
  private hasAttemptedParse = false;

  /**
   * Parse a chunk of streaming data into zero or more StreamEvents.
   * @param chunk - Raw chunk from the stream
   * @returns Array of parsed events (may be empty if chunk is incomplete)
   */
  parse(chunk: string): StreamEvent[] {
    this.buffer += chunk;
    const events: StreamEvent[] = [];

    // Auto-detect format on first chunk
    if (!this.hasAttemptedParse) {
      this.hasAttemptedParse = true;
      if (!this.looksLikeStructuredFormat(chunk)) {
        this.isRawTextMode = true;
      }
    }

    if (this.isRawTextMode) {
      return this.parseRawText();
    }

    // Try SSE format first (data: {...}\n\n)
    const sseEvents = this.parseSSE();
    if (sseEvents.length > 0) {
      events.push(...sseEvents);
    }

    // Try JSON lines format
    const jsonEvents = this.parseJSONLines();
    if (jsonEvents.length > 0) {
      events.push(...jsonEvents);
    }

    // If all parsing fails and we have content, fall back to raw text
    if (events.length === 0 && this.buffer.length > 0 && this.buffer.includes('\n')) {
      this.isRawTextMode = true;
      return this.parseRawText();
    }

    return events;
  }

  private looksLikeStructuredFormat(chunk: string): boolean {
    return chunk.trimStart().startsWith('data:') || chunk.trimStart().startsWith('{');
  }

  private parseSSE(): StreamEvent[] {
    const events: StreamEvent[] = [];
    const lines = this.buffer.split('\n\n');

    // Keep incomplete last chunk in buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        const event = this.tryParseJSON(data);
        if (event) events.push(event);
      }
    }

    return events;
  }

  private parseJSONLines(): StreamEvent[] {
    const events: StreamEvent[] = [];
    const lines = this.buffer.split('\n');

    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        const event = this.tryParseJSON(trimmed);
        if (event) events.push(event);
      }
    }

    return events;
  }

  private parseRawText(): StreamEvent[] {
    if (this.buffer.length === 0) return [];

    const event: StreamEvent = {
      type: 'text_delta',
      data: this.buffer,
      timestamp: Date.now(),
    };

    this.buffer = '';
    return [event];
  }

  private tryParseJSON(data: string): StreamEvent | undefined {
    try {
      const parsed = JSON.parse(data);
      return {
        type: parsed.type || 'text_delta',
        data: parsed.data || parsed.text || '',
        timestamp: parsed.timestamp || Date.now(),
      };
    } catch {
      return undefined;
    }
  }
}
