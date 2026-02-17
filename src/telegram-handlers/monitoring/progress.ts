import { getSessionProgress } from "../api/openclaw";
import type { CommandHandler } from "../types";
import { createError } from "../utils";

export const handleProgress: CommandHandler = async (ctx, args) => {
  const sessionKey = args[0];

  if (!sessionKey) {
    throw createError("INVALID_ARGS", "Session key required", "Usage: /progress <session-key>");
  }

  try {
    const progress = await getSessionProgress(sessionKey);

    let response = `📊 Progress for ${sessionKey}\n\n`;
    response += `Status: ${progress.status}\n`;
    if (progress.progress) {
      response += `Progress: ${progress.progress}\n`;
    }
    if (progress.eta) {
      response += `ETA: ${Math.ceil(progress.eta / 1000)}s remaining\n`;
    }

    await ctx.reply(response);
  } catch (error) {
    throw createError(
      "AGENT_NOT_FOUND",
      "Failed to retrieve session progress",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};
