/**
 * Domain Event Infrastructure
 * Provides event-driven architecture primitives for bounded contexts
 */

/**
 * Base interface for all domain events
 * @template T - Type of the event payload
 */
export interface DomainEvent<T = unknown> {
  readonly type: string;
  readonly payload: T;
  readonly timestamp: Date;
  readonly correlationId: string;
  readonly sourceContext: string;
}

/**
 * Factory function to create domain events with consistent metadata
 * @template T - Type of the event payload
 * @param type - Event type identifier
 * @param payload - Event data
 * @param sourceContext - Bounded context that emitted the event
 * @param correlationId - Optional correlation ID for distributed tracing
 * @returns A fully constructed domain event
 */
export function createEvent<T>(
  type: string,
  payload: T,
  sourceContext: string,
  correlationId?: string
): DomainEvent<T> {
  return {
    type,
    payload,
    timestamp: new Date(),
    correlationId: correlationId ?? crypto.randomUUID(),
    sourceContext,
  };
}

/**
 * Event bus interface for publish-subscribe pattern
 * Enables decoupled communication between bounded contexts
 */
export interface DomainEventBus {
  /**
   * Publish an event to all interested subscribers
   */
  publish(event: DomainEvent): void;

  /**
   * Subscribe to a specific event type
   * @returns Unsubscribe function
   */
  subscribe(eventType: string, handler: (event: DomainEvent) => void): () => void;

  /**
   * Subscribe to all events regardless of type
   * @returns Unsubscribe function
   */
  subscribeAll(handler: (event: DomainEvent) => void): () => void;
}
