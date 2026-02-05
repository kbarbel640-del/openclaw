/**
 * Inbound context finalization with prompt injection guarding.
 * 
 * This module provides a wrapper around finalizeInboundContext that adds
 * prompt injection detection and optional wrapping for all inbound content.
 */

import { logWarn } from "../globals.js";
import type { OpenClawConfig } from "../../config/config.js";
import {
  guardInboundContent,
  buildSecurityContext,
  type InboundContentSource,
} from "../../security/external-content.js";
import {
  shouldDetectPromptInjection,
  shouldWrapPromptInjection,
  shouldLogPromptInjection,
} from "../../config/security-resolver.js";
import {
  finalizeInboundContext,
  type FinalizeInboundContextOptions,
} from "./inbound-context.js";
import type { FinalizedMsgContext, MsgContext } from "../templating.js";

export type GuardedFinalizeOptions = FinalizeInboundContextOptions & {
  /** OpenClaw configuration (required for security checking) */
  config: OpenClawConfig;
  /** Source of the content */
  source: InboundContentSource;
  /** Channel identifier (e.g., "telegram", "discord") */
  channel?: string;
  /** Sender identifier for logging */
  sender?: string;
};

/**
 * Finalizes inbound context with optional prompt injection guarding.
 * 
 * This function wraps finalizeInboundContext and adds prompt injection detection
 * based on the security configuration. When enabled, it:
 * 1. Detects prompt injection patterns in BodyForAgent
 * 2. Logs detections for security monitoring
 * 3. Optionally wraps content with warnings
 * 
 * @param ctx - The message context to finalize
 * @param opts - Finalization options including config and source
 * @returns Finalized context with potentially guarded content
 * 
 * @example
 * ```ts
 * const ctxPayload = finalizeInboundContextWithGuard(rawContext, {
 *   config,
 *   source: "telegram",
 *   channel: "telegram",
 *   sender: ctx.SenderId,
 * });
 * ```
 */
export function finalizeInboundContextWithGuard<T extends Record<string, unknown>>(
  ctx: T,
  opts: GuardedFinalizeOptions,
): T & FinalizedMsgContext {
  const { config, source, channel, sender, ...finalizeOpts } = opts;
  
  // First, do the standard finalization
  const normalized = finalizeInboundContext(ctx, finalizeOpts);
  
  // Check if prompt injection detection is enabled
  const shouldDetect = shouldDetectPromptInjection(config, source);
  
  if (!shouldDetect) {
    return normalized;
  }
  
  // Get the content to check (BodyForAgent is what goes to the agent)
  const contentToCheck = normalized.BodyForAgent ?? "";
  
  if (!contentToCheck) {
    return normalized;
  }
  
  // Run the guard
  const shouldWrap = shouldWrapPromptInjection(config, source);
  const shouldLog = shouldLogPromptInjection(config, source);
  
  const result = guardInboundContent(contentToCheck, {
    source,
    channel,
    sender,
    shouldWrap,
  });
  
  // Log detection if enabled
  if (result.detected && shouldLog) {
    const securityCtx = buildSecurityContext({ source, channel, sender });
    const patternList = result.patterns.slice(0, 3).join(", ");
    logWarn(
      `[security] Prompt injection detected (${securityCtx}, patterns=${result.patterns.length}): ${patternList}`,
    );
  }
  
  // Update BodyForAgent if wrapping was applied
  if (result.wrapped && result.content !== contentToCheck) {
    normalized.BodyForAgent = result.content;
    // Add security metadata
    (normalized as Record<string, unknown>).SecurityWarning = 
      `Prompt injection patterns detected: ${result.patterns.join(", ")}`;
  }
  
  return normalized;
}
