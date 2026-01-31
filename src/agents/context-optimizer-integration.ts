import type { AgentMessage } from "@mariozechner/pi-agent-core";

import type { OpenClawConfig } from "../config/config.js";
import { optimizeBeforeCompaction } from "./context-optimizer.js";

/**
 * Integration point for context optimization in the agent pipeline
 * 
 * This function should be called before compaction to reduce the need for it
 * by proactively evicting non-essential content from the context.
 */
export function optimizeContextForAgent(
  messages: AgentMessage[], 
  config: OpenClawConfig,
  sessionKey?: string,
): AgentMessage[] {
  try {
    // Only optimize if the feature is enabled
    const optimizerConfig = config.experimental?.contextOptimizeCustom;
    if (!optimizerConfig?.enabled) {
      return messages;
    }

    // Apply context optimization before compaction
    const optimized = optimizeBeforeCompaction(messages, config);
    
    // Log optimization results if debug is enabled
    if (optimizerConfig.debug && sessionKey) {
      const savings = ((messages.length - optimized.length) / messages.length * 100).toFixed(1);
      console.log(
        `[ContextOptimizer] Session ${sessionKey}: ${messages.length} → ${optimized.length} messages (${savings}% reduction)`
      );
    }
    
    return optimized;
  } catch (error) {
    // Graceful fallback on any errors
    console.warn("[ContextOptimizer] Optimization failed, using original context:", error);
    return messages;
  }
}

/**
 * Check if context optimization should be applied based on context size
 */
export function shouldOptimizeContext(
  messages: AgentMessage[],
  config: OpenClawConfig,
  estimatedTokens?: number,
): boolean {
  const optimizerConfig = config.experimental?.contextOptimizeCustom;
  
  if (!optimizerConfig?.enabled) {
    return false;
  }

  // Apply optimization if we have too many messages
  if (messages.length > (optimizerConfig.evictionThreshold || 5) * 2) {
    return true;
  }

  // Apply optimization if we're approaching token limits
  if (estimatedTokens && optimizerConfig.maxContextRatio) {
    const maxTokens = 200_000; // Default context window, could be made configurable
    const currentRatio = estimatedTokens / maxTokens;
    return currentRatio > optimizerConfig.maxContextRatio;
  }

  return false;
}