import { toggleFastMode } from "../fast-mode.js";
import type { CommandHandler } from "./commands-types.js";

export const handleFastCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  const match = params.command.commandBodyNormalized.match(/^\/fast(?:\s|$)/i);
  if (!match) {
    return null;
  }

  const newState = toggleFastMode();
  const status = newState ? "✓ enabled" : "✓ disabled";

  return {
    shouldContinue: false,
    reply: {
      text: `Fast mode ${status}. In fast mode, thinking is reduced to minimal and a faster model variant is used for better performance.`,
    },
  };
};
