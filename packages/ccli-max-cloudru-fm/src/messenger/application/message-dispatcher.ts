import type { IMessengerPort } from '../ports/messenger-port.js';
import type { Result } from '../../core/types/result.js';
import type { OutgoingMessage, SendResult } from '../domain/types.js';
import type { MessengerError } from '../domain/errors.js';
import type { TenantIdString } from '../../core/types/tenant-id.js';
import type { DomainEventBus } from '../../core/types/domain-events.js';
import type { MessengerPlatform } from '../../core/types/messenger-platform.js';
import { err, isOk, isErr } from '../../core/types/result.js';
import { MessageDeliveryError } from '../domain/errors.js';
import { parseTenantId } from '../../core/types/tenant-id.js';
import { createEvent } from '../../core/types/domain-events.js';
/**
 * Dispatches outgoing messages through the correct messenger adapter
 */
export class MessageDispatcher {
  private adapters = new Map<MessengerPlatform, IMessengerPort>();

  constructor(private readonly eventBus?: DomainEventBus) {}

  /**
   * Register a messenger adapter for a specific platform
   */
  register(platform: MessengerPlatform, adapter: IMessengerPort): void {
    this.adapters.set(platform, adapter);
  }

  /**
   * Dispatch a message to the appropriate platform
   */
  async dispatch(
    tenantId: TenantIdString,
    msg: OutgoingMessage
  ): Promise<Result<SendResult, MessengerError>> {
    let platform: MessengerPlatform;
    try {
      const parsedTenantId = parseTenantId(tenantId);
      platform = parsedTenantId.platform;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return err(new MessageDeliveryError(`Invalid tenant ID: ${errorMsg}`)) as Result<never, MessengerError>;
    }

    const adapter = this.adapters.get(platform);

    if (!adapter) {
      const error = new MessageDeliveryError(`No adapter registered for platform: ${platform}`);
      this.emitDeliveryFailed(msg, platform, error.message);
      return err(error) as Result<never, MessengerError>;
    }

    const result = await adapter.sendMessage(msg);

    if (isErr(result)) {
      this.emitDeliveryFailed(msg, platform, result.error.message);
      return result;
    }

    if (isOk(result)) {
      this.eventBus?.publish(createEvent(
        'messenger.message.sent',
        {
          message: msg,
          result: result.value,
        },
        'messenger'
      ));
    }

    return result;
  }

  private emitDeliveryFailed(msg: OutgoingMessage, platform: MessengerPlatform, error: string): void {
    this.eventBus?.publish(createEvent(
      'messenger.message.delivery_failed',
      {
        message: msg,
        platform,
        error,
      },
      'messenger'
    ));
  }
}
