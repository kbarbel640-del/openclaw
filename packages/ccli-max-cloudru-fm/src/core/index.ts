/**
 * OpenClaw Core Shared Kernel
 *
 * Provides fundamental types, error handling, DI container, and event infrastructure
 * used across all bounded contexts.
 */

// Core types
export * from './types/index.js';
export type { Result } from './types/result.js';
export { ok, err, isOk, isErr, unwrap } from './types/result.js';
export type { OpenClawError } from './types/errors.js';
export { ValidationError, SecurityError, SessionError, ConcurrencyError, StreamError, ProviderError, PluginError, TrainingError } from './types/errors.js';
export type { DomainEvent, DomainEventBus } from './types/domain-events.js';
export { createEvent } from './types/domain-events.js';

// Dependency injection
export * from './di/index.js';

// Infrastructure
export { InProcessEventBus } from './infra/index.js';

// Container setup
export { createContainer, TOKENS } from './container.js';
