import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { parseAgentSessionKey } from "../routing/session-key.js";
import { resolveUserPath } from "../utils.js";

const TEAM_WORKSPACE_SUBDIR = ".team";
const ARTIFACTS_SUBDIR = "artifacts";
const DECISIONS_SUBDIR = "decisions";
const CONTEXT_SUBDIR = "context";
const CONTEXT_FILE = "context.json";

let lastDecisionTimestamp = 0;

function nextDecisionTimestamp(): number {
  const now = Date.now();
  // Ensure monotonic ordering even under fake timers or same-tick writes.
  if (now <= lastDecisionTimestamp) {
    lastDecisionTimestamp += 1;
    return lastDecisionTimestamp;
  }
  lastDecisionTimestamp = now;
  return now;
}

export type ArtifactMetadata = {
  createdAt: number;
  createdBy: string;
  modifiedAt: number;
  modifiedBy: string;
  description?: string;
  tags?: string[];
};

export type ArtifactEntry = {
  name: string;
  path: string;
  metadata: ArtifactMetadata;
};

export type TeamDecision = {
  id: string;
  topic: string;
  decision: string;
  participants: string[];
  timestamp: number;
  metadata?: {
    sessionKey?: string;
    proposals?: Array<{
      from: string;
      proposal: string;
      reasoning?: string;
    }>;
  };
};

/**
 * Resolve the team workspace directory for a given agent session
 */
export function resolveTeamWorkspace(requesterSessionKey: string): string {
  const _parsed = parseAgentSessionKey(requesterSessionKey);

  // Use the default workspace as the base, but respect OPENCLAW_STATE_DIR so tests and
  // sandboxed environments can redirect writes away from the user's home directory.
  const profile = process.env.OPENCLAW_PROFILE?.trim();
  const stateDir = resolveStateDir(process.env, os.homedir);
  const baseDir =
    profile && profile.toLowerCase() !== "default"
      ? path.join(stateDir, `workspace-${profile}`)
      : path.join(stateDir, "workspace");

  return path.join(resolveUserPath(baseDir), TEAM_WORKSPACE_SUBDIR);
}

/**
 * Ensure team workspace directories exist
 */
async function ensureTeamWorkspaceDirectories(teamWorkspaceDir: string): Promise<void> {
  await fs.mkdir(teamWorkspaceDir, { recursive: true });
  await fs.mkdir(path.join(teamWorkspaceDir, ARTIFACTS_SUBDIR), { recursive: true });
  await fs.mkdir(path.join(teamWorkspaceDir, DECISIONS_SUBDIR), { recursive: true });
  await fs.mkdir(path.join(teamWorkspaceDir, CONTEXT_SUBDIR), { recursive: true });
}

/**
 * Atomic file write: write to temp then rename
 */
async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    await fs.writeFile(tmpPath, content, "utf-8");
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    // Cleanup on failure
    try {
      await fs.unlink(tmpPath);
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Write an artifact to the team workspace
 */
export async function writeTeamArtifact(params: {
  requesterSessionKey: string;
  name: string;
  content: string;
  metadata?: {
    description?: string;
    tags?: string[];
  };
}): Promise<string> {
  const teamWorkspaceDir = resolveTeamWorkspace(params.requesterSessionKey);
  await ensureTeamWorkspaceDirectories(teamWorkspaceDir);

  const artifactsDir = path.join(teamWorkspaceDir, ARTIFACTS_SUBDIR);
  const sanitizedName = params.name.replace(/[^\w\-.]/g, "_");
  const artifactPath = path.join(artifactsDir, sanitizedName);

  const parsed = parseAgentSessionKey(params.requesterSessionKey);
  const agentId = parsed?.agentId || "unknown";

  // Load or create metadata
  const metadataPath = `${artifactPath}.meta.json`;
  let existingMetadata: ArtifactMetadata | null = null;
  try {
    const metaContent = await fs.readFile(metadataPath, "utf-8");
    existingMetadata = JSON.parse(metaContent) as ArtifactMetadata;
  } catch {
    // New artifact
  }

  const metadata: ArtifactMetadata = {
    createdAt: existingMetadata?.createdAt ?? Date.now(),
    createdBy: existingMetadata?.createdBy ?? agentId,
    modifiedAt: Date.now(),
    modifiedBy: agentId,
    description: params.metadata?.description ?? existingMetadata?.description,
    tags: params.metadata?.tags ?? existingMetadata?.tags,
  };

  // Write artifact and metadata atomically
  await atomicWriteFile(artifactPath, params.content);
  await atomicWriteFile(metadataPath, JSON.stringify(metadata, null, 2));

  return artifactPath;
}

/**
 * Read an artifact from the team workspace
 */
export async function readTeamArtifact(params: {
  requesterSessionKey: string;
  name: string;
}): Promise<string | null> {
  const teamWorkspaceDir = resolveTeamWorkspace(params.requesterSessionKey);
  const artifactsDir = path.join(teamWorkspaceDir, ARTIFACTS_SUBDIR);
  const sanitizedName = params.name.replace(/[^\w\-.]/g, "_");
  const artifactPath = path.join(artifactsDir, sanitizedName);

  try {
    return await fs.readFile(artifactPath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * List all artifacts in the team workspace
 */
export async function listTeamArtifacts(params: {
  requesterSessionKey: string;
}): Promise<ArtifactEntry[]> {
  const teamWorkspaceDir = resolveTeamWorkspace(params.requesterSessionKey);
  const artifactsDir = path.join(teamWorkspaceDir, ARTIFACTS_SUBDIR);

  try {
    await fs.mkdir(artifactsDir, { recursive: true });
  } catch {
    return [];
  }

  const entries: ArtifactEntry[] = [];

  try {
    const files = await fs.readdir(artifactsDir);
    const artifactFiles = files.filter((f) => !f.endsWith(".meta.json"));

    for (const file of artifactFiles) {
      const artifactPath = path.join(artifactsDir, file);
      const metadataPath = `${artifactPath}.meta.json`;

      let metadata: ArtifactMetadata = {
        createdAt: 0,
        createdBy: "unknown",
        modifiedAt: 0,
        modifiedBy: "unknown",
      };

      try {
        const metaContent = await fs.readFile(metadataPath, "utf-8");
        metadata = JSON.parse(metaContent) as ArtifactMetadata;
      } catch {
        // Use defaults if metadata missing
        try {
          const stats = await fs.stat(artifactPath);
          metadata.createdAt = stats.mtimeMs;
          metadata.modifiedAt = stats.mtimeMs;
        } catch {
          // Keep defaults
        }
      }

      entries.push({
        name: file,
        path: artifactPath,
        metadata,
      });
    }
  } catch {
    return [];
  }

  return entries.toSorted((a, b) => b.metadata.modifiedAt - a.metadata.modifiedAt);
}

/**
 * Write a key-value pair to the team context store
 */
export async function writeTeamContext(params: {
  requesterSessionKey: string;
  key: string;
  value: string;
}): Promise<void> {
  const teamWorkspaceDir = resolveTeamWorkspace(params.requesterSessionKey);
  await ensureTeamWorkspaceDirectories(teamWorkspaceDir);

  const contextPath = path.join(teamWorkspaceDir, CONTEXT_FILE);

  let context: Record<string, unknown> = {};
  try {
    const existing = await fs.readFile(contextPath, "utf-8");
    context = JSON.parse(existing) as Record<string, unknown>;
  } catch {
    // New context file
  }

  context[params.key] = params.value;

  await atomicWriteFile(contextPath, JSON.stringify(context, null, 2));
}

/**
 * Read a value from the team context store
 */
export async function readTeamContext(params: {
  requesterSessionKey: string;
  key: string;
}): Promise<string | null> {
  const teamWorkspaceDir = resolveTeamWorkspace(params.requesterSessionKey);
  const contextPath = path.join(teamWorkspaceDir, CONTEXT_FILE);

  try {
    const content = await fs.readFile(contextPath, "utf-8");
    const context = JSON.parse(content) as Record<string, unknown>;
    const value = context[params.key];
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return null;
  }
}

/**
 * Record a team decision for future reference
 */
export async function recordTeamDecision(params: {
  requesterSessionKey: string;
  topic: string;
  decision: string;
  participants: string[];
  metadata?: {
    sessionKey?: string;
    proposals?: Array<{
      from: string;
      proposal: string;
      reasoning?: string;
    }>;
  };
}): Promise<string> {
  const teamWorkspaceDir = resolveTeamWorkspace(params.requesterSessionKey);
  await ensureTeamWorkspaceDirectories(teamWorkspaceDir);

  const decisionsDir = path.join(teamWorkspaceDir, DECISIONS_SUBDIR);
  const decisionId = `decision-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const decisionPath = path.join(decisionsDir, `${decisionId}.json`);

  const record: TeamDecision = {
    id: decisionId,
    topic: params.topic,
    decision: params.decision,
    participants: params.participants,
    timestamp: nextDecisionTimestamp(),
    metadata: params.metadata,
  };

  await atomicWriteFile(decisionPath, JSON.stringify(record, null, 2));

  return decisionId;
}

/**
 * List all team decisions
 */
export async function listTeamDecisions(params: {
  requesterSessionKey: string;
}): Promise<TeamDecision[]> {
  const teamWorkspaceDir = resolveTeamWorkspace(params.requesterSessionKey);
  const decisionsDir = path.join(teamWorkspaceDir, DECISIONS_SUBDIR);

  try {
    await fs.mkdir(decisionsDir, { recursive: true });
  } catch {
    return [];
  }

  const decisions: TeamDecision[] = [];

  try {
    const files = await fs.readdir(decisionsDir);
    const decisionFiles = files.filter((f) => f.endsWith(".json"));

    for (const file of decisionFiles) {
      try {
        const filePath = path.join(decisionsDir, file);
        const content = await fs.readFile(filePath, "utf-8");
        const decision = JSON.parse(content) as TeamDecision;
        decisions.push(decision);
      } catch {
        // Skip malformed decision files
      }
    }
  } catch {
    return [];
  }

  return decisions.toSorted((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return b.timestamp - a.timestamp;
    }
    return b.id.localeCompare(a.id);
  });
}

/**
 * Build a summary of team context for injection into spawned agents
 */
export async function buildTeamContextSummary(params: {
  requesterSessionKey: string;
}): Promise<string> {
  const artifacts = await listTeamArtifacts(params);
  const decisions = await listTeamDecisions(params);

  let summary = "";

  if (decisions.length > 0) {
    summary += "\n## TEAM DECISIONS\n\n";
    const recentDecisions = decisions.slice(0, 5);
    for (const decision of recentDecisions) {
      summary += `### ${decision.topic}\n`;
      summary += `**Decision**: ${decision.decision}\n`;
      summary += `**Participants**: ${decision.participants.join(", ")}\n`;
      summary += `**Date**: ${new Date(decision.timestamp).toISOString()}\n\n`;
    }
    if (decisions.length > 5) {
      summary += `_(${decisions.length - 5} more decisions available)_\n\n`;
    }
  }

  if (artifacts.length > 0) {
    summary += "\n## TEAM ARTIFACTS\n\n";
    summary += "Available shared artifacts:\n";
    for (const artifact of artifacts) {
      const desc = artifact.metadata.description ? ` - ${artifact.metadata.description}` : "";
      summary += `- **${artifact.name}**${desc}\n`;
      if (artifact.metadata.tags && artifact.metadata.tags.length > 0) {
        summary += `  Tags: ${artifact.metadata.tags.join(", ")}\n`;
      }
    }
    summary += "\n";
  }

  if (!summary) {
    return "";
  }

  return `
# SHARED TEAM WORKSPACE CONTEXT

${summary}
Use the \`team_workspace\` tool to access these artifacts and context.
`.trim();
}
