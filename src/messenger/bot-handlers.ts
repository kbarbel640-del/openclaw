/**
 * Messenger bot message handlers.
 *
 * Handles incoming Messenger webhook events and dispatches them to the agent.
 */

import type { OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type {
  MessengerMessagingEvent,
  MessengerWebhookEntry,
  MessengerWebhookPayload,
  ResolvedMessengerAccount,
} from "./types.js";
import { logVerbose, danger } from "../globals.js";
import {
  buildMessengerMessageContext,
  parseMessengerEvent,
  type MessengerMessageContext,
} from "./bot-message-context.js";

/**
 * Handler for processing a single Messenger message context.
 */
export type MessengerMessageHandler = (context: MessengerMessageContext) => Promise<void>;

/**
 * Options for creating the Messenger event processor.
 */
export type MessengerEventProcessorOptions = {
  /** OpenClaw configuration. */
  cfg: OpenClawConfig;
  /** Resolved Messenger account. */
  account: ResolvedMessengerAccount;
  /** Runtime environment for logging. */
  runtime?: RuntimeEnv;
  /** Store of allowed senders (paired users). */
  storeAllowFrom?: string[];
  /** Handler for processing messages. */
  onMessage: MessengerMessageHandler;
  /** Optional handler for reaction events. */
  onReaction?: (event: MessengerMessagingEvent) => Promise<void>;
  /** Optional handler for postback events. */
  onPostback?: (event: MessengerMessagingEvent) => Promise<void>;
  /** Optional handler for read receipts. */
  onRead?: (event: MessengerMessagingEvent) => Promise<void>;
  /** Optional handler for delivery receipts. */
  onDelivery?: (event: MessengerMessagingEvent) => Promise<void>;
};

/**
 * Event processor result.
 */
export type MessengerEventProcessorResult = {
  /** Number of events processed. */
  processed: number;
  /** Number of events skipped. */
  skipped: number;
  /** Number of events that errored. */
  errored: number;
};

/**
 * Create a Messenger event processor.
 *
 * Returns a function that processes webhook payloads and dispatches
 * events to the appropriate handlers.
 */
export function createMessengerEventProcessor(
  options: MessengerEventProcessorOptions,
): (payload: MessengerWebhookPayload) => Promise<MessengerEventProcessorResult> {
  const {
    cfg,
    account,
    runtime,
    storeAllowFrom = [],
    onMessage,
    onReaction,
    onPostback,
    onRead,
    onDelivery,
  } = options;

  return async (payload: MessengerWebhookPayload): Promise<MessengerEventProcessorResult> => {
    const result: MessengerEventProcessorResult = {
      processed: 0,
      skipped: 0,
      errored: 0,
    };

    for (const entry of payload.entry) {
      for (const event of entry.messaging) {
        try {
          const eventResult = await processMessagingEvent({
            event,
            entry,
            cfg,
            account,
            runtime,
            storeAllowFrom,
            onMessage,
            onReaction,
            onPostback,
            onRead,
            onDelivery,
          });

          if (eventResult === "processed") {
            result.processed++;
          } else if (eventResult === "skipped") {
            result.skipped++;
          }
        } catch (err) {
          result.errored++;
          runtime?.error?.(danger(`messenger: event processing failed: ${String(err)}`));
        }
      }
    }

    return result;
  };
}

/**
 * Process a single messaging event.
 */
async function processMessagingEvent(params: {
  event: MessengerMessagingEvent;
  entry: MessengerWebhookEntry;
  cfg: OpenClawConfig;
  account: ResolvedMessengerAccount;
  runtime?: RuntimeEnv;
  storeAllowFrom: string[];
  onMessage: MessengerMessageHandler;
  onReaction?: (event: MessengerMessagingEvent) => Promise<void>;
  onPostback?: (event: MessengerMessagingEvent) => Promise<void>;
  onRead?: (event: MessengerMessagingEvent) => Promise<void>;
  onDelivery?: (event: MessengerMessagingEvent) => Promise<void>;
}): Promise<"processed" | "skipped"> {
  const {
    event,
    cfg,
    account,
    runtime,
    storeAllowFrom,
    onMessage,
    onReaction,
    onPostback,
    onRead,
    onDelivery,
  } = params;

  // Handle read receipts
  if (event.read) {
    if (onRead) {
      await onRead(event);
      return "processed";
    }
    logVerbose(`messenger: read receipt from ${event.sender.id}`);
    return "skipped";
  }

  // Handle delivery receipts
  if (event.delivery) {
    if (onDelivery) {
      await onDelivery(event);
      return "processed";
    }
    logVerbose(`messenger: delivery receipt for ${event.delivery.mids?.length ?? 0} messages`);
    return "skipped";
  }

  // Handle reaction events
  if (event.reaction) {
    if (onReaction) {
      await onReaction(event);
      return "processed";
    }
    logVerbose(
      `messenger: reaction ${event.reaction.action} "${event.reaction.emoji}" on ${event.reaction.mid}`,
    );
    return "skipped";
  }

  // Handle postback events (button clicks)
  if (event.postback) {
    logVerbose(`messenger: postback "${event.postback.title}" from ${event.sender.id}`);
    // Postbacks are processed as messages
    if (onPostback) {
      await onPostback(event);
      return "processed";
    }
    // Fall through to message processing
  }

  // Handle optin events
  if (event.optin) {
    logVerbose(`messenger: optin from ${event.sender.id} ref=${event.optin.ref ?? "none"}`);
    return "skipped";
  }

  // Handle referral events
  if (event.referral) {
    logVerbose(`messenger: referral from ${event.sender.id} ref=${event.referral.ref}`);
    return "skipped";
  }

  // Parse the event
  const parsedMessage = parseMessengerEvent(event);
  if (!parsedMessage) {
    logVerbose("messenger: could not parse event");
    return "skipped";
  }

  // Build message context
  const context = await buildMessengerMessageContext({
    event,
    parsedMessage,
    cfg,
    account,
    storeAllowFrom,
    runtime,
  });

  if (!context) {
    return "skipped";
  }

  // Dispatch to message handler
  await onMessage(context);
  return "processed";
}

/**
 * Log details about a Messenger event for debugging.
 */
export function logMessengerEvent(event: MessengerMessagingEvent, runtime?: RuntimeEnv): void {
  const senderId = event.sender.id;
  const pageId = event.recipient.id;
  const timestamp = event.timestamp;

  if (event.message) {
    const msg = event.message;
    const preview = msg.text?.slice(0, 50) ?? "[no text]";
    const attachmentCount = msg.attachments?.length ?? 0;
    runtime?.log?.(
      `messenger: message from=${senderId} page=${pageId} ts=${timestamp} ` +
        `text="${preview}" attachments=${attachmentCount}`,
    );
  } else if (event.postback) {
    runtime?.log?.(
      `messenger: postback from=${senderId} page=${pageId} ts=${timestamp} ` +
        `title="${event.postback.title}" payload="${event.postback.payload}"`,
    );
  } else if (event.reaction) {
    runtime?.log?.(
      `messenger: reaction from=${senderId} page=${pageId} ts=${timestamp} ` +
        `action=${event.reaction.action} emoji="${event.reaction.emoji}"`,
    );
  } else if (event.read) {
    runtime?.log?.(
      `messenger: read from=${senderId} page=${pageId} ts=${timestamp} ` +
        `watermark=${event.read.watermark}`,
    );
  } else if (event.delivery) {
    runtime?.log?.(
      `messenger: delivery page=${pageId} ts=${timestamp} ` +
        `count=${event.delivery.mids?.length ?? 0}`,
    );
  } else {
    runtime?.log?.(`messenger: unknown event from=${senderId} page=${pageId} ts=${timestamp}`);
  }
}

/**
 * Extract the event type from a Messenger messaging event.
 */
export function getMessengerEventType(
  event: MessengerMessagingEvent,
): "message" | "postback" | "reaction" | "read" | "delivery" | "optin" | "referral" | "unknown" {
  if (event.message) {
    return "message";
  }
  if (event.postback) {
    return "postback";
  }
  if (event.reaction) {
    return "reaction";
  }
  if (event.read) {
    return "read";
  }
  if (event.delivery) {
    return "delivery";
  }
  if (event.optin) {
    return "optin";
  }
  if (event.referral) {
    return "referral";
  }
  return "unknown";
}

/**
 * Check if an event is a user-initiated message (not echo, delivery, or read).
 */
export function isUserInitiatedEvent(event: MessengerMessagingEvent): boolean {
  // Skip echoes
  if (event.message?.is_echo) {
    return false;
  }

  // Skip delivery/read receipts
  if (event.delivery || event.read) {
    return false;
  }

  // Messages, postbacks, reactions, optins, referrals are user-initiated
  return Boolean(
    event.message || event.postback || event.reaction || event.optin || event.referral,
  );
}

/**
 * Count user-initiated events in a webhook payload.
 */
export function countUserInitiatedEvents(payload: MessengerWebhookPayload): number {
  let count = 0;
  for (const entry of payload.entry) {
    for (const event of entry.messaging) {
      if (isUserInitiatedEvent(event)) {
        count++;
      }
    }
  }
  return count;
}
