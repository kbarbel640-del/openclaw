// Tool policy - UI standalone version (no Node.js dependencies)

export type ToolProfileId = "minimal" | "coding" | "messaging" | "full";

type ToolProfilePolicy = {
  allow?: string[];
  deny?: string[];
};

const TOOL_NAME_ALIASES: Record<string, string> = {
  bash: "exec",
  "apply-patch": "apply_patch",
};

export const TOOL_GROUPS: Record<string, string[]> = {
  "group:memory": ["memory_search", "memory_get"],
  "group:web": ["web_search", "web_fetch"],
  "group:fs": ["read", "write", "edit", "apply_patch"],
  "group:runtime": ["exec", "process"],
  "group:sessions": [
    "sessions_list",
    "sessions_history",
    "sessions_send",
    "sessions_spawn",
    "subagents",
    "session_status",
  ],
  "group:ui": ["browser", "canvas"],
  "group:automation": ["cron", "gateway"],
  "group:messaging": ["message"],
  "group:nodes": ["nodes"],
  "group:openclaw": [
    "browser",
    "canvas",
    "nodes",
    "cron",
    "gateway",
    "read",
    "write",
    "edit",
    "apply_patch",
    "exec",
    "process",
    "memory_search",
    "memory_get",
    "web_search",
    "web_fetch",
    "message",
    "sessions_list",
    "sessions_history",
    "sessions_send",
    "sessions_spawn",
    "subagents",
    "session_status",
  ],
  "group:feishu": ["feishu_doc", "feishu_wiki", "feishu_drive", "feishu_app_scopes"],
  "group:messaging-extras": [
    "message_send",
    "message_react",
    "message_edit",
    "message_delete",
    "channel_list",
  ],
};

const TOOL_PROFILE_POLICIES: Record<ToolProfileId, ToolProfilePolicy> = {
  minimal: {
    allow: ["group:messaging", "web_search", "web_fetch"],
  },
  coding: {
    allow: ["group:openclaw", "group:feishu"],
    deny: ["gateway"],
  },
  messaging: {
    allow: ["group:messaging", "group:messaging-extras", "group:web"],
  },
  full: {},
};

export function normalizeToolName(name: string): string {
  const normalized = name.trim().toLowerCase();
  return TOOL_NAME_ALIASES[normalized] ?? normalized;
}

export function expandToolGroups(patterns: string[]): string[] {
  const expanded: string[] = [];
  for (const pattern of patterns) {
    if (pattern.startsWith("group:") && TOOL_GROUPS[pattern]) {
      expanded.push(...TOOL_GROUPS[pattern]);
    } else {
      expanded.push(pattern);
    }
  }
  return [...new Set(expanded)];
}

export function resolveToolProfilePolicy(profile: ToolProfileId): ToolProfilePolicy | undefined {
  return TOOL_PROFILE_POLICIES[profile];
}
