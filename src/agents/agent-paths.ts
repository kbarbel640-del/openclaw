import { resolveDefaultAgentDir } from "./agent-scope.js";
import { resolveUserPath } from "../utils.js";

export function resolveClawdbotAgentDir(): string {
  const override =
    process.env.CLAWDBOT_AGENT_DIR?.trim() ||
    process.env.PI_CODING_AGENT_DIR?.trim() ||
    resolveDefaultAgentDir();
  return resolveUserPath(override);
}

export function ensureClawdbotAgentEnv(): string {
  const dir = resolveClawdbotAgentDir();
  if (!process.env.CLAWDBOT_AGENT_DIR) process.env.CLAWDBOT_AGENT_DIR = dir;
  if (!process.env.PI_CODING_AGENT_DIR) process.env.PI_CODING_AGENT_DIR = dir;
  return dir;
}
