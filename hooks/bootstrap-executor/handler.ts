/**
 * Bootstrap Executor Hook
 *
 * Adds instruction to execute BOOTSTRAP.md when new session starts
 */

import type { HookHandler } from "../../src/hooks/hooks.js";

const handler: HookHandler = async (event) => {
  // Only trigger on new/reset commands
  if (event.type !== "command") return;
  if (event.action !== "new" && event.action !== "reset") return;

  // Add instruction to messages - this will be shown to the agent
  event.messages.push(
    "⚠️ BOOTSTRAP: Before responding, read and execute BOOTSTRAP.md from your workspace. " +
      "Check SESSION-STATE.md for current context, read memory/today, and follow PRE-checklist from SOUL.md.",
  );
};

export default handler;
