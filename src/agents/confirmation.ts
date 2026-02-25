/**
 * Simplified confirmation system with button interaction handling
 *
 * Usage:
 * ```typescript
 * const confirmed = await confirmDestructive({
 *   action: "delete",
 *   target: "/path/to/file",
 *   cfg: openclawConfig,
 *   channel: "1475765287436554280"
 * });
 *
 * if (confirmed) {
 *   // Proceed with delete
 * }
 * ```
 */

import type { OpenClawConfig } from "../config/config.js";

export type ConfirmationScene = "destructive" | "access-request" | "generic";

export type ConfirmationOptions = {
  scene: ConfirmationScene;
  title?: string;
  description?: string;
  target?: string;
  timeoutMs?: number;
  channel: string;
  cfg: OpenClawConfig;
};

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Send a confirmation message with buttons and wait for user response
 *
 * NOTE: This is a simplified implementation. In production, you should:
 * 1. Set up a webhook or Gateway event handler for button interactions
 * 2. Store pending confirmations in a Map with requestId as key
 * 3. Resolve the promise when interaction is received
 *
 * For now, this sends the message and returns a placeholder.
 */
export async function requestConfirmation(options: ConfirmationOptions): Promise<string | null> {
  const { scene, title, description, target, timeoutMs, channel, cfg } = options;

  // Import dynamically to avoid circular dependencies
  const { callGateway } = await import("../gateway/call.js");
  const { generateUUID } = await import("../utils/uuid.js");

  const requestId = generateUUID();
  const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Scene configurations
  const configs: Record<
    ConfirmationScene,
    { title: string; buttons: Array<{ label: string; style: number; custom_id: string }> }
  > = {
    destructive: {
      title: title ?? "⚠️ Confirm Destructive Action",
      buttons: [
        { label: "✅ Confirm", style: 4, custom_id: `confirm:${requestId}:confirm` },
        { label: "Cancel", style: 2, custom_id: `confirm:${requestId}:cancel` },
      ],
    },
    "access-request": {
      title: title ?? "🔵 Access Request",
      buttons: [
        { label: "✅ Allow", style: 3, custom_id: `confirm:${requestId}:allow` },
        { label: "⏳ Temp Allow", style: 1, custom_id: `confirm:${requestId}:allow-once` },
        { label: "❌ Deny", style: 4, custom_id: `confirm:${requestId}:deny` },
      ],
    },
    generic: {
      title: title ?? "❓ Confirmation Required",
      buttons: [
        { label: "✅ Yes", style: 3, custom_id: `confirm:${requestId}:yes` },
        { label: "❌ No", style: 2, custom_id: `confirm:${requestId}:no` },
      ],
    },
  };

  const config = configs[scene];

  // Build message content
  let content = `## ${config.title}\n`;
  if (description) {
    content += `${description}\n`;
  }
  if (target) {
    content += `\n**Target:** \`${target}\`\n`;
  }
  content += `\n*Expires in ${Math.ceil(timeout / 1000)}s* | ID: \`${requestId}\``;

  // Send message with buttons via Gateway
  try {
    const result = await callGateway({
      config: cfg,
      method: "message.send",
      params: {
        channel,
        content,
        components: [
          {
            type: 1, // ActionRow
            components: config.buttons,
          },
        ],
      },
    });

    if (!result.success) {
      console.error("[CONFIRMATION] Failed to send:", result.error);
      return null;
    }

    console.log(`[CONFIRMATION] Sent ${requestId} to ${channel}`);

    // TODO: Implement interaction handling
    // For now, return null to indicate "not yet implemented"
    // In production, this should wait for button click via:
    // 1. Gateway event subscription
    // 2. Webhook endpoint
    // 3. Polling mechanism

    return null;
  } catch (err) {
    console.error("[CONFIRMATION] Error:", err);
    return null;
  }
}

/**
 * Convenience function for destructive actions
 */
export async function confirmDestructive(params: {
  action: string;
  target: string;
  cfg: OpenClawConfig;
  channel: string;
  timeoutMs?: number;
}): Promise<boolean> {
  const decision = await requestConfirmation({
    scene: "destructive",
    title: `⚠️ Confirm: ${params.action}`,
    description: `Are you sure you want to **${params.action}**?`,
    target: params.target,
    timeoutMs: params.timeoutMs,
    channel: params.channel,
    cfg: params.cfg,
  });

  return decision === "confirm";
}

/**
 * Convenience function for access requests
 */
export async function confirmAccessRequest(params: {
  requesterName: string;
  requesterId: string;
  cfg: OpenClawConfig;
  channel: string;
  timeoutMs?: number;
}): Promise<"allow" | "allow-once" | "deny" | "timeout"> {
  const decision = await requestConfirmation({
    scene: "access-request",
    title: "🔵 Access Request",
    description: `**${params.requesterName}** is requesting access`,
    target: params.requesterId,
    timeoutMs: params.timeoutMs,
    channel: params.channel,
    cfg: params.cfg,
  });

  if (decision === "allow" || decision === "allow-once" || decision === "deny") {
    return decision;
  }
  return "timeout";
}
