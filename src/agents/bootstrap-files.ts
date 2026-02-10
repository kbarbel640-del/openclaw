import type { OpenClawConfig } from "../config/config.js";
import type { EmbeddedContextFile } from "./pi-embedded-helpers.js";
import { applyBootstrapHookOverrides } from "./bootstrap-hooks.js";
import { buildBootstrapContextFiles, resolveBootstrapMaxChars } from "./pi-embedded-helpers.js";
import {
  DEFAULT_HEARTBEAT_FILENAME,
  filterBootstrapFilesForSession,
  loadWorkspaceBootstrapFiles,
  type WorkspaceBootstrapFile,
} from "./workspace.js";

export function makeBootstrapWarn(params: {
  sessionLabel: string;
  warn?: (message: string) => void;
}): ((message: string) => void) | undefined {
  if (!params.warn) {
    return undefined;
  }
  return (message: string) => params.warn?.(`${message} (sessionKey=${params.sessionLabel})`);
}

export async function resolveBootstrapFilesForRun(params: {
  workspaceDir: string;
  config?: OpenClawConfig;
  sessionKey?: string;
  sessionId?: string;
  agentId?: string;
}): Promise<WorkspaceBootstrapFile[]> {
  const sessionKey = params.sessionKey ?? params.sessionId;
  let bootstrapFiles = filterBootstrapFilesForSession(
    await loadWorkspaceBootstrapFiles(params.workspaceDir),
    sessionKey,
  );

  // When a dedicated heartbeat session is configured, only include HEARTBEAT.md
  // for that session. This prevents heartbeat monitoring instructions from
  // running on every user message.
  bootstrapFiles = filterHeartbeatFile(bootstrapFiles, {
    sessionKey,
    config: params.config,
  });

  return applyBootstrapHookOverrides({
    files: bootstrapFiles,
    workspaceDir: params.workspaceDir,
    config: params.config,
    sessionKey: params.sessionKey,
    sessionId: params.sessionId,
    agentId: params.agentId,
  });
}

/**
 * Exclude HEARTBEAT.md from non-heartbeat sessions when a dedicated
 * heartbeat session key is configured.
 *
 * If no dedicated session is set (or it resolves to "main"/"global"),
 * the file is kept for all sessions to preserve backward compatibility.
 */
function filterHeartbeatFile(
  files: WorkspaceBootstrapFile[],
  params: { sessionKey?: string; config?: OpenClawConfig },
): WorkspaceBootstrapFile[] {
  const hbSession = params.config?.agents?.defaults?.heartbeat?.session?.trim();

  // No dedicated heartbeat session → keep current behaviour (include for all).
  if (!hbSession) return files;
  const lower = hbSession.toLowerCase();
  if (lower === "main" || lower === "global") return files;

  // If the current session key matches the heartbeat session, include it.
  if (params.sessionKey && params.sessionKey.toLowerCase().includes(lower)) {
    return files;
  }

  // Otherwise strip HEARTBEAT.md so regular chat sessions don't see it.
  return files.filter((f) => f.name !== DEFAULT_HEARTBEAT_FILENAME);
}

export async function resolveBootstrapContextForRun(params: {
  workspaceDir: string;
  config?: OpenClawConfig;
  sessionKey?: string;
  sessionId?: string;
  agentId?: string;
  warn?: (message: string) => void;
}): Promise<{
  bootstrapFiles: WorkspaceBootstrapFile[];
  contextFiles: EmbeddedContextFile[];
}> {
  const bootstrapFiles = await resolveBootstrapFilesForRun(params);
  const contextFiles = buildBootstrapContextFiles(bootstrapFiles, {
    maxChars: resolveBootstrapMaxChars(params.config),
    warn: params.warn,
  });
  return { bootstrapFiles, contextFiles };
}
