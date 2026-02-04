/**
 * LLM-based slug and type generator for session memory filenames
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runEmbeddedPiAgent } from "../agents/pi-embedded.js";
import type { OpenClawConfig } from "../config/config.js";
import {
  resolveDefaultAgentId,
  resolveAgentWorkspaceDir,
  resolveAgentDir,
} from "../agents/agent-scope.js";
import type { MemoryType, SlugAndTypeResult } from "../memory/types.js";

const VALID_MEMORY_TYPES: MemoryType[] = [
  "profile",
  "event",
  "knowledge",
  "behavior",
  "skill",
  "unclassified",
];

/**
 * Generate a short 1-2 word filename slug and memory type from session content using LLM.
 * Returns both slug and type classification.
 */
export async function generateSlugAndTypeViaLLM(params: {
  sessionContent: string;
  cfg: OpenClawConfig;
}): Promise<SlugAndTypeResult> {
  let tempSessionFile: string | null = null;

  try {
    const agentId = resolveDefaultAgentId(params.cfg);
    const workspaceDir = resolveAgentWorkspaceDir(params.cfg, agentId);
    const agentDir = resolveAgentDir(params.cfg, agentId);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-slug-"));
    tempSessionFile = path.join(tempDir, "session.jsonl");

    const prompt = `Based on this conversation, generate:
1. A short 1-2 word filename slug (lowercase, hyphen-separated, no file extension)
2. A memory type classification

Conversation summary:
${params.sessionContent.slice(0, 2000)}

Memory types:
- profile: User preferences, personal info, identity
- event: Time-bound happenings, appointments, meetings
- knowledge: Facts, concepts, technical information
- behavior: Habits, patterns, workflows
- skill: Abilities, techniques, how-to knowledge

Reply with ONLY valid JSON in this exact format:
{"slug": "example-slug", "type": "knowledge"}`;

    const result = await runEmbeddedPiAgent({
      sessionId: `slug-generator-${Date.now()}`,
      sessionKey: "temp:slug-generator",
      sessionFile: tempSessionFile,
      workspaceDir,
      agentDir,
      config: params.cfg,
      prompt,
      timeoutMs: 15_000,
      runId: `slug-gen-${Date.now()}`,
    });

    if (result.payloads && result.payloads.length > 0) {
      const text = result.payloads[0]?.text;
      if (text) {
        return parseSlugAndTypeResponse(text);
      }
    }

    return { slug: null, type: "unclassified" };
  } catch (err) {
    console.error("[llm-slug-generator] Failed to generate slug and type:", err);
    return { slug: null, type: "unclassified" };
  } finally {
    if (tempSessionFile) {
      try {
        await fs.rm(path.dirname(tempSessionFile), { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Parse LLM response to extract slug and type.
 * Handles both JSON format and plain text fallback.
 */
function parseSlugAndTypeResponse(text: string): SlugAndTypeResult {
  const trimmed = text.trim();

  // Try JSON parsing first
  try {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { slug?: string; type?: string };
      const slug = cleanSlug(parsed.slug);
      const type = validateMemoryType(parsed.type);
      return { slug, type };
    }
  } catch {
    // Fall through to plain text parsing
  }

  // Fallback: treat entire response as slug, default type
  const slug = cleanSlug(trimmed);
  return { slug, type: "unclassified" };
}

function cleanSlug(raw: string | undefined): string | null {
  if (!raw) return null;
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  return slug || null;
}

function validateMemoryType(raw: string | undefined): MemoryType {
  if (!raw) return "unclassified";
  const normalized = raw.trim().toLowerCase() as MemoryType;
  return VALID_MEMORY_TYPES.includes(normalized) ? normalized : "unclassified";
}

/**
 * Generate a short 1-2 word filename slug from session content using LLM.
 * @deprecated Use generateSlugAndTypeViaLLM for both slug and type classification.
 */
export async function generateSlugViaLLM(params: {
  sessionContent: string;
  cfg: OpenClawConfig;
}): Promise<string | null> {
  const result = await generateSlugAndTypeViaLLM(params);
  return result.slug;
}
