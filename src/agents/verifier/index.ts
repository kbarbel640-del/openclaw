import crypto from "node:crypto";
import type { VerifierConfig } from "../../config/types.tools.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { isToolInVerifierScope } from "./scope.js";
import { callTelegramVerifier } from "./telegram.js";
import { callWebhookVerifier, redactToolParams, type VerifierRequest } from "./webhook.js";

const log = createSubsystemLogger("verifier");

export type VerifierOutcome = { blocked: true; reason: string } | { blocked: false };

export function resolveVerifierConfig(
  config: VerifierConfig | undefined,
): VerifierConfig | undefined {
  if (!config || config.enabled === false) {
    return undefined;
  }
  if (!config.webhook && !config.telegram?.enabled) {
    return undefined;
  }
  return config;
}

/**
 * Resolve the effective failMode using most-restrictive-wins strategy.
 * Per-agent failMode cannot weaken global failMode:
 *   global "deny" + agent "allow" -> "deny" (global wins)
 *   global "allow" + agent "deny" -> "deny" (agent wins)
 */
export function resolveFailMode(
  globalFailMode: "deny" | "allow" | undefined,
  agentFailMode: "deny" | "allow" | undefined,
): "deny" | "allow" {
  if (globalFailMode === "deny" || agentFailMode === "deny") {
    return "deny";
  }
  return agentFailMode ?? globalFailMode ?? "deny";
}

export async function runVerifier(params: {
  config: VerifierConfig | undefined;
  globalConfig?: VerifierConfig | undefined;
  toolName: string;
  params: Record<string, unknown>;
  agentId?: string;
  sessionKey?: string;
  messageProvider?: string;
}): Promise<VerifierOutcome> {
  const config = resolveVerifierConfig(params.config);
  if (!config) {
    return { blocked: false };
  }

  if (!isToolInVerifierScope(params.toolName, config.scope)) {
    return { blocked: false };
  }

  const failMode = resolveFailMode(params.globalConfig?.failMode, config.failMode);

  const requestId = crypto.randomUUID();
  const redactedParams = redactToolParams(params.toolName, params.params);

  const request: VerifierRequest = {
    version: 1,
    timestamp: new Date().toISOString(),
    requestId,
    tool: { name: params.toolName, params: redactedParams },
    context: {
      agentId: params.agentId,
      sessionKey: params.sessionKey,
      messageProvider: params.messageProvider,
    },
  };

  // Run webhook verification
  if (config.webhook?.url) {
    const result = await callWebhookVerifier({
      url: config.webhook.url,
      timeout: config.webhook.timeout ?? 30,
      headers: config.webhook.headers,
      secret: config.webhook.secret,
      request,
    });

    if (result.decision === "deny") {
      log.info(`verifier denied: tool=${params.toolName} reason=${result.reason ?? "denied"}`);
      return { blocked: true, reason: result.reason ?? "Denied by external verifier" };
    }
    if (result.decision === "error") {
      log.warn(`verifier error: tool=${params.toolName} reason=${result.reason}`);
      if (failMode === "deny") {
        return {
          blocked: true,
          reason: `Verifier unreachable (failMode=deny): ${result.reason}`,
        };
      }
    }
  }

  // Run Telegram verification
  if (config.telegram?.enabled && config.telegram.botToken && config.telegram.chatId) {
    const result = await callTelegramVerifier({
      botToken: config.telegram.botToken,
      chatId: config.telegram.chatId,
      timeout: config.telegram.timeout ?? 120,
      toolName: params.toolName,
      toolParams: redactedParams,
      agentId: params.agentId,
      sessionKey: params.sessionKey,
      requestId,
      allowedUserIds: config.telegram.allowedUserIds,
    });

    if (result.decision === "deny") {
      log.info(`verifier denied (telegram): tool=${params.toolName}`);
      return { blocked: true, reason: result.reason ?? "Denied via Telegram" };
    }
    if (result.decision === "error") {
      log.warn(`verifier error (telegram): tool=${params.toolName} reason=${result.reason}`);
      if (failMode === "deny") {
        return {
          blocked: true,
          reason: `Telegram verifier error (failMode=deny): ${result.reason}`,
        };
      }
    }
  }

  return { blocked: false };
}
