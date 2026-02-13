/**
 * Streaming pipeline types for OpenClaw streaming response handling.
 * Defines event types, configuration, and flush behavior.
 */

/**
 * Type of streaming events that can be emitted during an LLM stream.
 */
export type StreamEventType = 'text_delta' | 'tool_use' | 'tool_result' | 'error' | 'done';

/**
 * Represents a single event in the streaming response.
 */
export interface StreamEvent {
  readonly type: StreamEventType;
  readonly data: string;
  readonly timestamp: number;
}

/**
 * Reason why a token buffer was flushed.
 */
export type FlushReason = 'token_count' | 'timeout' | 'boundary' | 'done';

/**
 * Result of flushing accumulated tokens.
 */
export interface FlushResult {
  readonly text: string;
  readonly reason: FlushReason;
  readonly tokenCount: number;
}

/**
 * Configuration for streaming response behavior.
 */
export interface StreamConfig {
  readonly flushTokenThreshold: number;       // Flush when buffer reaches this many tokens
  readonly flushTimeoutMs: number;             // Flush after this many ms of inactivity
  readonly maxMessageLength: number;           // Split messages longer than this
  readonly typingIndicatorIntervalMs: number;  // Send typing indicator at this interval
}

/**
 * Default streaming configuration values.
 */
export const DEFAULT_STREAM_CONFIG: StreamConfig = {
  flushTokenThreshold: 50,
  flushTimeoutMs: 500,
  maxMessageLength: 4096,
  typingIndicatorIntervalMs: 4000,
};
