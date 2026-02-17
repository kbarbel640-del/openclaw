/**
 * Loads custom model capability patterns from config at boot time.
 */

import type { OpenClawConfig } from "../config/config.js";
import { registerModelPattern } from "./capability-inference.js";
import type { ModelCapabilities } from "./model-capabilities.js";

/**
 * Load and register model patterns from config.
 * Should be called during application boot.
 *
 * @param config - OpenClaw configuration object
 */
export function loadModelPatternsFromConfig(config: OpenClawConfig): void {
  const patterns = config.agents?.defaults?.modelPatterns;

  if (!patterns || typeof patterns !== "object") {
    return;
  }

  let registeredCount = 0;

  for (const [pattern, capabilities] of Object.entries(patterns)) {
    if (!pattern || !capabilities || typeof capabilities !== "object") {
      console.warn(`[capability-patterns-loader] Invalid pattern entry: ${pattern}`);
      continue;
    }

    try {
      registerModelPattern(pattern, capabilities as Partial<ModelCapabilities>);
      registeredCount++;
    } catch (error) {
      console.error(`[capability-patterns-loader] Failed to register pattern "${pattern}":`, error);
    }
  }

  if (registeredCount > 0) {
    console.info(
      `[capability-patterns-loader] Registered ${registeredCount} custom model pattern(s)`,
    );
  }
}

/**
 * Validate model patterns configuration without registering.
 * Useful for config validation during tests or schema checking.
 *
 * @param patterns - Model patterns object from config
 * @returns Array of validation errors (empty if valid)
 */
export function validateModelPatterns(patterns: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (!patterns || typeof patterns !== "object") {
    return ["modelPatterns must be an object"];
  }

  for (const [pattern, capabilities] of Object.entries(patterns)) {
    if (!pattern || typeof pattern !== "string" || pattern.trim() === "") {
      errors.push("Pattern key must be a non-empty string");
      continue;
    }

    if (!capabilities || typeof capabilities !== "object") {
      errors.push(`Pattern "${pattern}": capabilities must be an object`);
      continue;
    }

    const caps = capabilities as Record<string, unknown>;

    // Validate known capability fields
    if ("coding" in caps && typeof caps.coding !== "boolean") {
      errors.push(`Pattern "${pattern}": coding must be boolean`);
    }

    if ("reasoning" in caps && typeof caps.reasoning !== "boolean") {
      errors.push(`Pattern "${pattern}": reasoning must be boolean`);
    }

    if ("vision" in caps && typeof caps.vision !== "boolean") {
      errors.push(`Pattern "${pattern}": vision must be boolean`);
    }

    if ("general" in caps && typeof caps.general !== "boolean") {
      errors.push(`Pattern "${pattern}": general must be boolean`);
    }

    if ("fast" in caps && typeof caps.fast !== "boolean") {
      errors.push(`Pattern "${pattern}": fast must be boolean`);
    }

    if ("creative" in caps && typeof caps.creative !== "boolean") {
      errors.push(`Pattern "${pattern}": creative must be boolean`);
    }

    if ("performanceTier" in caps) {
      const validTiers = ["fast", "balanced", "powerful"];
      if (!validTiers.includes(caps.performanceTier as string)) {
        errors.push(
          `Pattern "${pattern}": performanceTier must be one of: ${validTiers.join(", ")}`,
        );
      }
    }

    if ("costTier" in caps) {
      const validCosts = ["free", "cheap", "moderate", "expensive"];
      if (!validCosts.includes(caps.costTier as string)) {
        errors.push(`Pattern "${pattern}": costTier must be one of: ${validCosts.join(", ")}`);
      }
    }

    if ("primary" in caps && typeof caps.primary !== "string") {
      errors.push(`Pattern "${pattern}": primary must be string`);
    }
  }

  return errors;
}
