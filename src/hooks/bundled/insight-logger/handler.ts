/**
 * Insight Logger hook handler
 *
 * Extracts operational insights (debugging, config fixes, architecture decisions)
 * from completed sessions and appends them to docs/ru/insight.md.
 *
 * Triggers on command:new — reads the previous session transcript, sends it to
 * the LLM with a structured extraction prompt, and appends any findings.
 */

import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { OpenClawConfig } from "../../../config/config.js";
import type { HookHandler } from "../../hooks.js";
import {
  resolveDefaultAgentId,
  resolveAgentWorkspaceDir,
  resolveAgentDir,
} from "../../../agents/agent-scope.js";
import { runEmbeddedPiAgent } from "../../../agents/pi-embedded.js";
import { createSubsystemLogger } from "../../../logging/subsystem.js";
import { hasInterSessionUserProvenance } from "../../../sessions/input-provenance.js";
import { resolveHookConfig } from "../../config.js";

const log = createSubsystemLogger("hooks/insight-logger");

const INSIGHT_PROMPT = `You are an operational insight extractor for the OpenClaw project.
Analyze the conversation below and determine if it contains any operational insights worth recording.

An insight is worth recording if the session involved ANY of:
- Debugging a problem (symptoms → root cause → fix)
- Discovering a configuration issue or gotcha
- Finding an undocumented behavior or limitation
- Applying a workaround for a known issue
- Architecture or infrastructure decision

If the session contains NO operational insights (e.g., just documentation, coding, or casual chat), reply with exactly: NO_INSIGHTS

If there ARE insights, write a structured entry in Russian following this EXACT format:

---

# Инсайт: <краткое описание>

> **Дата:** <месяц год>

## Симптомы

<Таблица или список: что наблюдалось, как проявлялась проблема>

## Суть проблемы

<Корневая причина: почему это происходило>

## Решение

<Что конкретно было сделано для устранения, с командами/файлами/конфигами>

---

Rules:
- Write ONLY in Russian
- Be specific: include file paths, config keys, command names, error messages
- Use markdown tables where appropriate
- Keep it concise but complete — another engineer should be able to reproduce the fix
- Do NOT include code blocks longer than 10 lines
- Multiple insights from one session should be separate sections`;

/**
 * Read recent messages from a session file
 */
async function getSessionContent(
  sessionFilePath: string,
  messageCount: number,
): Promise<string | null> {
  try {
    const content = await fs.readFile(sessionFilePath, "utf-8");
    const lines = content.trim().split("\n");

    const allMessages: string[] = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === "message" && entry.message) {
          const msg = entry.message;
          const role = msg.role;
          if ((role === "user" || role === "assistant") && msg.content) {
            if (role === "user" && hasInterSessionUserProvenance(msg)) {
              continue;
            }
            const text = Array.isArray(msg.content)
              ? // oxlint-disable-next-line typescript/no-explicit-any
                msg.content.find((c: any) => c.type === "text")?.text
              : msg.content;
            if (text && !text.startsWith("/")) {
              allMessages.push(`${role}: ${text}`);
            }
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    const recentMessages = allMessages.slice(-messageCount);
    return recentMessages.length > 0 ? recentMessages.join("\n") : null;
  } catch {
    return null;
  }
}

/**
 * Find the project root by walking up from the workspace dir looking for package.json
 */
function findProjectRoot(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    try {
      const candidate = path.join(dir, "package.json");
      const stat = fsSync.statSync(candidate);
      if (stat.isFile()) {
        return dir;
      }
    } catch {
      // keep walking up
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return null;
}

const insightLogger: HookHandler = async (event) => {
  if (event.type !== "command" || event.action !== "new") {
    return;
  }

  try {
    log.debug("Insight logger triggered");

    const context = event.context || {};
    const cfg = context.cfg as OpenClawConfig | undefined;
    if (!cfg) {
      log.debug("No config available, skipping");
      return;
    }

    // Read hook config
    const hookConfig = resolveHookConfig(cfg, "insight-logger");
    const messageCount =
      typeof hookConfig?.messages === "number" && hookConfig.messages > 0
        ? hookConfig.messages
        : 30;

    // Get previous session file
    const sessionEntry = (context.previousSessionEntry || context.sessionEntry || {}) as Record<
      string,
      unknown
    >;
    const sessionFile = sessionEntry.sessionFile as string | undefined;
    if (!sessionFile) {
      log.debug("No previous session file, skipping");
      return;
    }

    // Read session content
    const sessionContent = await getSessionContent(sessionFile, messageCount);
    if (!sessionContent || sessionContent.length < 200) {
      log.debug("Session too short for insight extraction, skipping");
      return;
    }

    // Skip in test environments
    const isTestEnv =
      process.env.OPENCLAW_TEST_FAST === "1" ||
      process.env.VITEST === "true" ||
      process.env.VITEST === "1" ||
      process.env.NODE_ENV === "test";
    if (isTestEnv) {
      log.debug("Test environment, skipping LLM call");
      return;
    }

    log.info("Extracting insights from session...");

    // Call LLM to extract insights
    const agentId = resolveDefaultAgentId(cfg);
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const agentDir = resolveAgentDir(cfg, agentId);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-insight-"));
    const tempSessionFile = path.join(tempDir, "session.jsonl");

    try {
      const prompt = `${INSIGHT_PROMPT}

Conversation (last ${messageCount} messages):
${sessionContent.slice(0, 8000)}`;

      const result = await runEmbeddedPiAgent({
        sessionId: `insight-logger-${Date.now()}`,
        sessionKey: "temp:insight-logger",
        agentId,
        sessionFile: tempSessionFile,
        workspaceDir,
        agentDir,
        config: cfg,
        prompt,
        timeoutMs: 30_000,
        runId: `insight-${Date.now()}`,
      });

      // Extract text from result
      const text = result.payloads?.[0]?.text?.trim();
      if (!text || text === "NO_INSIGHTS" || text.includes("NO_INSIGHTS")) {
        log.info("No insights found in session");
        return;
      }

      // Find the insight file
      const projectRoot = findProjectRoot(workspaceDir) || workspaceDir;
      const insightFile = path.join(projectRoot, "docs", "ru", "insight.md");

      // Ensure directory exists
      await fs.mkdir(path.dirname(insightFile), { recursive: true });

      // Append the insight
      const separator = "\n\n";
      await fs.appendFile(insightFile, separator + text + "\n", "utf-8");

      const relPath = insightFile.replace(os.homedir(), "~");
      log.info(`Insight appended to ${relPath}`);
    } finally {
      // Clean up temp files
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch (err) {
    if (err instanceof Error) {
      log.error("Failed to extract insights", {
        errorName: err.name,
        errorMessage: err.message,
      });
    } else {
      log.error("Failed to extract insights", { error: String(err) });
    }
  }
};

export default insightLogger;
