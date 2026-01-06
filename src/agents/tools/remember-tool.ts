import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { Type } from "@sinclair/typebox";

import type {
  MemoryFragmentImportance,
  MemoryFragmentType,
} from "../../config/types.js";
import { type AnyAgentTool, jsonResult, readStringParam } from "./common.js";

const RememberToolSchema = Type.Object({
  content: Type.String({
    description:
      "What to remember - the fact, decision, task, or insight to store",
  }),
  type: Type.Optional(
    Type.Union([
      Type.Literal("fact"),
      Type.Literal("decision"),
      Type.Literal("task"),
      Type.Literal("insight"),
    ]),
  ),
  importance: Type.Optional(
    Type.Union([Type.Literal("ephemeral"), Type.Literal("persistent")]),
  ),
});

export type RememberToolContext = {
  /** Session key (e.g., "main", "telegram:group:-123456") */
  sessionKey: string;
  /** Human-readable session name (e.g., "Deep Work") */
  sessionDisplayName?: string;
  /** Memory workspace path (default: ~/clawd) */
  memoryWorkspace?: string;
};

/**
 * Resolves the memory workspace path.
 * Priority: explicit config > ~/clawd
 */
function resolveMemoryWorkspace(explicit?: string): string {
  if (explicit) {
    return explicit.startsWith("~")
      ? path.join(os.homedir(), explicit.slice(1))
      : explicit;
  }
  return path.join(os.homedir(), "clawd");
}

/**
 * Creates a memory fragment file in the inbox.
 * File format: YAML frontmatter + markdown content
 */
async function writeMemoryFragment(params: {
  content: string;
  type: MemoryFragmentType;
  importance: MemoryFragmentImportance;
  sessionKey: string;
  sessionDisplayName?: string;
  memoryWorkspace: string;
}): Promise<{ filename: string; path: string }> {
  const inboxDir = path.join(params.memoryWorkspace, "memory", "inbox");

  // Ensure inbox directory exists
  await fs.mkdir(inboxDir, { recursive: true });

  const timestamp = new Date().toISOString();
  const hash = crypto.randomBytes(4).toString("hex");
  const filename = `${Date.now()}_${hash}.md`;
  const filePath = path.join(inboxDir, filename);

  // Build YAML frontmatter
  const frontmatter = [
    "---",
    `type: ${params.type}`,
    `importance: ${params.importance}`,
    `session: ${params.sessionKey}`,
    params.sessionDisplayName
      ? `sessionName: "${params.sessionDisplayName}"`
      : null,
    `timestamp: ${timestamp}`,
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  const fileContent = `${frontmatter}\n${params.content}`;
  await fs.writeFile(filePath, fileContent, "utf-8");

  return { filename, path: filePath };
}

/**
 * Creates the remember tool for storing memories to the inbox.
 *
 * This tool writes memory fragments to ~/clawd/memory/inbox/ (or configured workspace).
 * A consolidation job processes the inbox and updates daily logs + memory.md.
 */
export function createRememberTool(context: RememberToolContext): AnyAgentTool {
  const memoryWorkspace = resolveMemoryWorkspace(context.memoryWorkspace);

  return {
    label: "Remember",
    name: "remember",
    description: `Store a memory fragment for consolidation. Use this when the user says "remember", "note", "log this", or you need to persist important information across sessions. Memories are written to an inbox and consolidated every 30 minutes into daily logs and long-term memory.

Types:
- fact: A piece of information or knowledge
- decision: A choice or conclusion that was made
- task: Something to do or follow up on
- insight: An observation or realization

Importance:
- ephemeral: Daily log only (routine notes, temporary info)
- persistent: Daily log + long-term memory.md (preferences, decisions, durable facts)`,
    parameters: RememberToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const content = readStringParam(params, "content", { required: true });
      const type =
        (readStringParam(params, "type") as MemoryFragmentType) || "fact";
      const importance =
        (readStringParam(params, "importance") as MemoryFragmentImportance) ||
        "ephemeral";

      try {
        const result = await writeMemoryFragment({
          content,
          type,
          importance,
          sessionKey: context.sessionKey,
          sessionDisplayName: context.sessionDisplayName,
          memoryWorkspace,
        });

        // Build user-friendly status message
        const typeEmoji = {
          fact: "📝",
          decision: "✅",
          task: "📋",
          insight: "💡",
        }[type];
        const importanceLabel =
          importance === "persistent" ? "→ long-term memory" : "→ daily log";
        const preview =
          content.length > 50 ? `${content.slice(0, 50)}...` : content;

        return jsonResult({
          success: true,
          message: `${typeEmoji} Remembered: "${preview}" ${importanceLabel}`,
          filename: result.filename,
          type,
          importance,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResult({
          success: false,
          error: `Failed to write memory: ${message}`,
        });
      }
    },
  };
}
