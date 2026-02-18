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
 *  - `CompactionTriageButton` — Carbon Button subclass for building UI rows
 *  - `sendCompactionTriageButtons()` — POST a Do All / Skip All button row to Discord
 *
 * # Wiring:
 *
 * ## Step 1 — Register handler in agent-components.ts + provider.ts
 * See `createCompactionTriageHandlerButton()` in agent-components.ts.
 * In provider.ts createComponents(): `components.push(createCompactionTriageHandlerButton(ctx))`
 *
 * ## Step 2 — Send triage buttons from get-reply-run.ts
 * When building the triage payload for a Discord channel with inlineButtons capability:
 * ```ts
 * if (isDiscord && hasInlineButtons) {
 *   const channelId = extractDiscordChannelId(sessionKey);
 *   if (channelId) {
 *     void sendCompactionTriageButtons({ channelId, cfg, accountId });
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

import {
  Button,
  Row,
  serializePayload,
  type MessagePayloadObject,
  type TopLevelComponents,
} from "@buape/carbon";
import { ButtonStyle, Routes } from "discord-api-types/v10";
import type { OpenClawConfig } from "../../config/config.js";
import { createDiscordClient } from "../send.shared.js";

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
  const action = match[1];
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

/**
 * Carbon Button subclass used to build the UI row for `sendCompactionTriageButtons`.
 * Interaction handling is done by `CompactionTriageHandlerButton` in agent-components.ts.
 */
export class CompactionTriageButton extends Button {
  style: ButtonStyle;
  label: string;
  customId: string;
  defer = false;

  constructor(action: CompactionTriageAction) {
    super();
    this.label = buildCompactionTriageButtonLabel(action);
    this.customId = buildCompactionTriageCustomId(action);
    this.style = action === "skip_all" ? ButtonStyle.Secondary : ButtonStyle.Success;
  }

  async run(): Promise<void> {
    // Interaction handling is delegated to CompactionTriageHandlerButton (registered in provider.ts).
    // This class is only used to build serialized button payloads.
  }
}

/**
 * POST a two-button row (✅ Do All, ⏭️ Skip All) to a Discord channel.
 * Called from get-reply-run.ts when entering stage-2 triage on a Discord surface
 * with the `inlineButtons` capability enabled.
 */
export async function sendCompactionTriageButtons(params: {
  channelId: string;
  cfg: OpenClawConfig;
  accountId?: string;
}): Promise<void> {
  const doAllBtn = new CompactionTriageButton("do_all");
  const skipAllBtn = new CompactionTriageButton("skip_all");
  const row = new Row([doAllBtn, skipAllBtn]);
  const components: TopLevelComponents[] = [row];
  const messagePayload: MessagePayloadObject = { components };
  const body = serializePayload(messagePayload);

  const { rest } = createDiscordClient({ accountId: params.accountId }, params.cfg);
  await rest.post(Routes.channelMessages(params.channelId), {
    body,
  });
}
