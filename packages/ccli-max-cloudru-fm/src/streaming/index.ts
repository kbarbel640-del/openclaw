/**
 * OpenClaw streaming bounded context.
 * Provides streaming response handling with platform-specific adapters.
 *
 * ADR-010: Streaming Response Pipeline
 */

// Re-export pipeline types and classes
export type {
  StreamEventType,
  StreamEvent,
  FlushReason,
  FlushResult,
  StreamConfig,
} from './pipeline/index.js';

export {
  DEFAULT_STREAM_CONFIG,
  StreamParser,
  TokenAccumulator,
  LongMessageSplitter,
  SessionLock,
  StreamingResponseHandler,
} from './pipeline/index.js';

// Re-export adapter types and classes
export type { IStreamAdapter } from './adapters/index.js';

export {
  getStreamConfigForPlatform,
  BatchFallbackAdapter,
} from './adapters/index.js';
