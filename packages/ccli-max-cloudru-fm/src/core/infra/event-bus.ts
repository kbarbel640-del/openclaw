import { DomainEvent, DomainEventBus } from '../types/domain-events.js';
import { createLogger } from './logger.js';

const logger = createLogger('InProcessEventBus');

type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => void | Promise<void>;

/**
 * In-process event bus implementation with error isolation
 * Handler errors are caught and logged without crashing the bus
 */
export class InProcessEventBus implements DomainEventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly allHandlers = new Set<EventHandler>();

  /**
   * Subscribe to a specific event type
   * @param eventType The event type to subscribe to
   * @param handler The handler function
   * @returns Unsubscribe function
   */
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): () => void {
    let handlers = this.handlers.get(eventType);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(eventType, handlers);
    }
    handlers.add(handler as EventHandler);

    return () => {
      const set = this.handlers.get(eventType);
      if (set) {
        set.delete(handler as EventHandler);
        if (set.size === 0) {
          this.handlers.delete(eventType);
        }
      }
    };
  }

  /**
   * Subscribe to all events
   * @param handler The handler function
   * @returns Unsubscribe function
   */
  subscribeAll(handler: EventHandler): () => void {
    this.allHandlers.add(handler);
    return () => {
      this.allHandlers.delete(handler);
    };
  }

  /**
   * Publish an event to all subscribed handlers
   * Errors are isolated and logged without crashing the bus
   * @param event The domain event to publish
   */
  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || new Set();
    const allHandlers = [...handlers, ...this.allHandlers];

    await Promise.all(
      allHandlers.map(async (handler) => {
        try {
          await handler(event);
        } catch (error) {
          logger.error({ err: error, eventType: event.type }, 'Event handler error');
        }
      })
    );
  }
}
