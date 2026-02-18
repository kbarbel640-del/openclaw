/**
 * Discord inline buttons for post-compaction triage (Issue #90, Phase 3).
 *
 * When a session enters stage-2 triage (`compactionTriagePending = true`),
 * and the Discord channel has `inlineButtons` capability enabled, two buttons
 * are sent alongside the triage prompt:
 *   - ✅ Do All — injects "do all" into the session as a system event
 *   - ⏭️ Skip All — injects "skip all" into the session as a system event
 *
 * This module provides:
 *  - `COMPACTION_TRIAGE_KEY` — custom ID prefix for button routing
 *  - `buildCompactionTriageCustomId()` — encode action into a custom ID
 *  - `parseCompactionTriageCustomId()` — decode custom ID back to action
 *  - `COMPACTION_TRIAGE_ACTIONS` — the two supported actions
 *
 * # Wiring (TODO for integration):
 *
 * ## Step 1 — Register handler in provider.ts
 * ```ts
 * import { CompactionTriageButton } from "./compaction-triage.js";
 * // In createComponents():
 * components.push(new CompactionTriageButton(ctx));
 * ```
 *
 * ## Step 2 — Send triage buttons from get-reply-run.ts
 * When building the triage payload for a Discord channel with inlineButtons capability:
 * ```ts
 * // Detect Discord + inlineButtons capability
 * const isDiscordWithButtons = surface === "discord" &&
 *   resolveChannelCapabilities(cfg, "discord").has("inlinebuttons");
 *
 * if (isDiscordWithButtons && sessionKey) {
 *   const channelId = extractDiscordChannelId(sessionKey);
 *   if (channelId) {
 *     // Send a follow-up component message with Do All / Skip All buttons
 *     // (uses sendDiscordComponentMessage — see send.components.ts)
 *   }
 * }
 * ```
 *
 * ## Step 3 — Enable capability in config
 * ```yaml
 * channels:
 *   discord:
 *     capabilities:
 *       - inlineButtons
 * ```
 */

export const COMPACTION_TRIAGE_KEY = "compactiontriage";

export type CompactionTriageAction = "do_all" | "skip_all";

export const COMPACTION_TRIAGE_ACTIONS = {
  doAll: "do_all" as CompactionTriageAction,
  skipAll: "skip_all" as CompactionTriageAction,
} as const;

/** Map from CompactionTriageAction to the text injected as a system event. */
export const COMPACTION_TRIAGE_EVENT_TEXT: Record<CompactionTriageAction, string> = {
  do_all: "do all",
  skip_all: "skip all",
};

/**
 * Build a Discord component custom ID for a compaction triage button.
 * Format: compactiontriage:action=<action>
 */
export function buildCompactionTriageCustomId(action: CompactionTriageAction): string {
  return `${COMPACTION_TRIAGE_KEY}:action=${action}`;
}

/**
 * Parse a custom ID string back to a CompactionTriageAction.
 * Returns null if the string is not a valid compaction triage custom ID.
 */
export function parseCompactionTriageCustomId(
  customId: string,
): { action: CompactionTriageAction } | null {
  if (!customId.startsWith(`${COMPACTION_TRIAGE_KEY}:`)) {
    return null;
  }
  const match = customId.match(/action=([^;]+)/);
  if (!match) {
    return null;
  }
  const action = match[1] as string;
  if (action !== "do_all" && action !== "skip_all") {
    return null;
  }
  return { action };
}

/**
 * Build a human-readable label for a compaction triage button.
 */
export function buildCompactionTriageButtonLabel(action: CompactionTriageAction): string {
  return action === "do_all" ? "✅ Do All" : "⏭️ Skip All";
}
