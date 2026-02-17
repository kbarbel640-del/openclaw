import fs from "node:fs/promises";
import path from "node:path";
import type { OpenClawConfig } from "../config/config.js";
import { resolveAgentConfig } from "./agent-scope.js";
import type { WorkspaceBootstrapFile } from "./workspace.js";

export function resolvePersonaKey(cfg: OpenClawConfig | undefined, agentId: string | undefined) {
  if (!cfg) {
    return undefined;
  }
  const agentKey = agentId ? resolveAgentConfig(cfg, agentId)?.persona?.trim() : "";
  if (agentKey) {
    return agentKey;
  }
  const defaultKey = cfg.agents?.defaults?.persona?.trim();
  return defaultKey || undefined;
}

function resolvePersonaPath(params: { workspaceDir: string; persona: string }): string {
  const raw = params.persona.trim();
  // If the user passes a path-ish value, treat it as workspace-relative unless absolute.
  const looksLikePath = raw.includes("/") || raw.includes("\\") || raw.endsWith(".md");
  if (looksLikePath) {
    const candidate = path.isAbsolute(raw) ? raw : path.join(params.workspaceDir, raw);
    return path.resolve(candidate);
  }
  return path.resolve(path.join(params.workspaceDir, "personas", `${raw}.md`));
}

export async function applyPersonaToBootstrapFiles(params: {
  files: WorkspaceBootstrapFile[];
  workspaceDir: string;
  cfg?: OpenClawConfig;
  agentId?: string;
  readFile?: (filePath: string) => Promise<string>;
}): Promise<WorkspaceBootstrapFile[]> {
  const persona = resolvePersonaKey(params.cfg, params.agentId);
  if (!persona) {
    return params.files;
  }

  const soulIndex = params.files.findIndex((file) => file.name === "SOUL.md");
  if (soulIndex < 0) {
    return params.files;
  }

  const personaPath = resolvePersonaPath({ workspaceDir: params.workspaceDir, persona });
  const readFile = params.readFile ?? ((filePath: string) => fs.readFile(filePath, "utf-8"));

  let content: string;
  try {
    content = (await readFile(personaPath)).trim();
  } catch {
    return params.files;
  }
  if (!content) {
    return params.files;
  }

  const updated = [...params.files];
  updated[soulIndex] = {
    ...updated[soulIndex],
    // Keep the name/path stable (still SOUL.md) but inject the persona content.
    content,
    missing: false,
  };
  return updated;
}
