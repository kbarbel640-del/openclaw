import { execSync } from "node:child_process";

export interface PrePromptHookConfig {
  enabled: boolean;
  command: string;
  timeoutMs?: number;
  maxTokens?: number;
  position?: "afterSystem" | "beforeUser";
}

export function runPrePromptHook(
  config: PrePromptHookConfig,
  lastUserMessage: string,
): string | null {
  if (!config.enabled) {
    return null;
  }

  const timeoutMs = config.timeoutMs ?? 5000;
  const maxChars = (config.maxTokens ?? 2000) * 4; // rough token-to-char

  const command = config.command.replace(
    "{{lastUserMessage}}",
    lastUserMessage.replace(/'/g, "'\\''"),
  ); // escape for shell

  try {
    const stdout = execSync(command, {
      timeout: timeoutMs,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    if (!stdout) {
      return null;
    }

    // Truncate to budget
    return stdout.length > maxChars ? stdout.slice(0, maxChars) + "\n[truncated]" : stdout;
  } catch {
    // Silent failure — don't block agent turns if hook fails
    return null;
  }
}
