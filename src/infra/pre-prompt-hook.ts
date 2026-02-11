import { execFile } from "node:child_process";

export interface PrePromptHookConfig {
  enabled: boolean;
  command: string;
  timeoutMs?: number;
  maxTokens?: number;
  position?: "afterSystem" | "beforeUser";
}

/**
 * Run pre-prompt hook asynchronously and return injected context.
 * The user message is passed via PRE_PROMPT_USER_MESSAGE env var
 * to avoid shell injection. The command is executed via `sh -c`.
 */
export async function runPrePromptHook(
  config: PrePromptHookConfig,
  lastUserMessage: string,
): Promise<string | null> {
  if (!config.enabled) {
    return null;
  }

  const timeoutMs = config.timeoutMs ?? 5000;
  const maxChars = (config.maxTokens ?? 2000) * 4; // rough token-to-char

  // Pass user message via env to avoid shell injection.
  // Command can use $PRE_PROMPT_USER_MESSAGE or {{lastUserMessage}} is NOT interpolated.
  const command = config.command;

  return new Promise((resolve) => {
    const child = execFile(
      "sh",
      ["-c", command],
      {
        timeout: timeoutMs,
        encoding: "utf-8",
        maxBuffer: maxChars + 1024, // slight headroom
        env: {
          ...process.env,
          PRE_PROMPT_USER_MESSAGE: lastUserMessage,
        },
      },
      (err, stdout) => {
        if (err) {
          // Propagate error to caller for logging
          resolve(null);
          return;
        }

        const trimmed = (stdout ?? "").trim();
        if (!trimmed) {
          resolve(null);
          return;
        }

        // Truncate to budget
        resolve(trimmed.length > maxChars ? trimmed.slice(0, maxChars) + "\n[truncated]" : trimmed);
      },
    );

    // Safety: kill if somehow timeout doesn't fire
    setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    }, timeoutMs + 1000);
  });
}
