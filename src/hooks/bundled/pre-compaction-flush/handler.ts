/**
 * Pre-Compaction Flush Hook
 *
 * Intercepts the /compact command and injects a system event reminding the agent
 * to flush memory (update daily logs, PROJECT-STATE files, etc.) before context
 * is compacted.
 */

import type { HookHandler } from "../../hooks.js";
import { createSubsystemLogger } from "../../../logging/subsystem.js";

const log = createSubsystemLogger("hooks/pre-compaction-flush");

const FLUSH_MESSAGE = [
  "Context was just compacted. Please update your memory files now:",
  "1. Update today's `memory/YYYY-MM-DD.md` with session progress (decisions, progress, blockers)",
  "2. Update any PROJECT-STATE.md files you touched this session",
  "3. Update `PROJECTS.md` Last Touched dates for active projects",
  "4. If mid-complex-work, create a handoff file",
].join("\n");

export const handler: HookHandler = async (event) => {
  if (event.type !== "command" || event.action !== "compact") {
    return;
  }

  log.info(`Pre-compaction flush triggered for session ${event.sessionKey}`);

  // Push a system message that will be shown to the user/agent
  event.messages.push(FLUSH_MESSAGE);
};
