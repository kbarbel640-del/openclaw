// Domain types
export type {
  TrainingExample,
  ExampleCategory,
  QualityScore,
  FeedbackEntry,
  TrainingContext,
  ContextBuildConfig,
} from './domain/types.js';
export { DEFAULT_CONTEXT_CONFIG } from './domain/types.js';

// Domain errors
export {
  TrainingContextError,
  ExampleNotFoundError,
  InvalidExampleError,
  ContextTooLargeError,
  FeedbackError,
} from './domain/errors.js';

// Domain events
export type {
  ExampleAdded,
  ExampleRemoved,
  ExampleRated,
  FeedbackReceived,
  ContextBuilt,
  ContextInvalidated,
} from './domain/events.js';

// Application interfaces
export type { IExampleStore, ExampleFilter } from './application/example-store.js';
export type { IFeedbackStore } from './application/feedback-store.js';

// Application implementations
export { InMemoryExampleStore } from './application/in-memory-example-store.js';
export { InMemoryFeedbackStore } from './application/in-memory-feedback-store.js';
export { ContextBuilder } from './application/context-builder.js';
export type { TokenEstimator } from './application/context-builder.js';
export { FeedbackProcessor } from './application/feedback-processor.js';
export type { ConversationMessage } from './application/feedback-processor.js';
export { ExampleValidator } from './application/example-validator.js';
