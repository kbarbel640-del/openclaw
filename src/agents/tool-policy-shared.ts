import {
  CORE_TOOL_GROUPS,
  resolveCoreToolProfilePolicy,
  type ToolProfileId,
} from "./tool-catalog.js";

type ToolProfilePolicy = {
  allow?: string[];
  deny?: string[];
};

const TOOL_NAME_ALIASES: Record<string, string> = {
  bash: "exec",
  "apply-patch": "apply_patch",
};

export const TOOL_GROUPS: Record<string, string[]> = { ...CORE_TOOL_GROUPS };

export function normalizeToolName(name: string) {
  const normalized = name.trim().toLowerCase();
  return TOOL_NAME_ALIASES[normalized] ?? normalized;
}

/**
 * Sanitize a tool name for use in provider APIs that require the pattern
 * `^[a-zA-Z0-9_-]+$` (e.g. OpenAI Responses API). Replaces any character
 * outside that set with an underscore, strips leading/trailing underscores
 * and hyphens, and falls back to "tool" if the result is empty.
 */
export function sanitizeToolNameForApi(name: string): string {
  const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/^[_-]+|[_-]+$/g, "");
  return sanitized || "tool";
}

export function normalizeToolList(list?: string[]) {
  if (!list) {
    return [];
  }
  return list.map(normalizeToolName).filter(Boolean);
}

export function expandToolGroups(list?: string[]) {
  const normalized = normalizeToolList(list);
  const expanded: string[] = [];
  for (const value of normalized) {
    const group = TOOL_GROUPS[value];
    if (group) {
      expanded.push(...group);
      continue;
    }
    expanded.push(value);
  }
  return Array.from(new Set(expanded));
}

export function resolveToolProfilePolicy(profile?: string): ToolProfilePolicy | undefined {
  return resolveCoreToolProfilePolicy(profile);
}

export type { ToolProfileId };
