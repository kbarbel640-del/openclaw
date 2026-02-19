/**
 * AI Fabric Resource Sync Orchestrator
 *
 * Top-level orchestrator that syncs Cloud.ru AI Fabric resources
 * to the Claude CLI workspace:
 *
 * 1. MCP servers → claude-mcp-cloudru.json + .claude/settings.json
 * 2. Agents & systems → SKILL.md files in managed skills dir
 * 3. Re-sync → picks up new skills via syncSkillsToClaudeCommands
 *
 * Can be called from:
 * - /status_agents plugin (fire-and-forget after status display)
 * - Gateway startup (best-effort)
 * - `openclaw fabric sync` CLI command
 *
 * Reusable across: plugins, CLI, gateway.
 */

import path from "node:path";
import type { OpenClawConfig } from "../config/config.js";
import type { AgentStatusEntry } from "./agent-status.js";
import type { AgentSystemStatusEntry } from "./agent-system-status.js";
import type { FabricSkillTarget } from "./generate-fabric-skills.js";
import type { McpStatusEntry } from "./mcp-status.js";
import {
  syncMcpToClaudeSettings,
  syncSkillsToClaudeCommands,
} from "../agents/skills/claude-commands-sync.js";
import { writeMcpConfigFile } from "../commands/write-mcp-config.js";
import { buildMcpConfig } from "../commands/write-mcp-config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { getAgentStatus } from "./agent-status.js";
import { getAgentSystemStatus } from "./agent-system-status.js";
import { CloudruSimpleClient } from "./cloudru-client-simple.js";
import { generateFabricSkills } from "./generate-fabric-skills.js";
import { getMcpServerStatus } from "./mcp-status.js";

const log = createSubsystemLogger("fabric-sync");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SyncFabricParams = {
  config: OpenClawConfig;
  workspaceDir: string;
  projectId: string;
  auth: { keyId: string; secret: string };
  /** Pre-fetched entries (skip API calls if provided). */
  agentEntries?: AgentStatusEntry[];
  mcpEntries?: McpStatusEntry[];
  agentSystemEntries?: AgentSystemStatusEntry[];
};

export type SyncFabricResult =
  | { ok: true; mcpServers: number; skills: number }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function syncFabricResources(params: SyncFabricParams): Promise<SyncFabricResult> {
  const { config, workspaceDir, projectId, auth } = params;

  // Fetch status if not pre-supplied
  let agentEntries = params.agentEntries;
  let mcpEntries = params.mcpEntries;
  let systemEntries = params.agentSystemEntries;

  if (!agentEntries || !mcpEntries || !systemEntries) {
    const authParams = { keyId: auth.keyId, secret: auth.secret };
    const [agentResult, mcpResult, systemResult] = await Promise.all([
      agentEntries
        ? Promise.resolve(null)
        : getAgentStatus({
            projectId,
            auth: authParams,
            configuredAgents: config.aiFabric?.agents ?? [],
          }),
      mcpEntries ? Promise.resolve(null) : getMcpServerStatus({ projectId, auth: authParams }),
      systemEntries ? Promise.resolve(null) : getAgentSystemStatus({ projectId, auth: authParams }),
    ]);

    if (!agentEntries && agentResult) {
      agentEntries = agentResult.ok ? agentResult.entries : [];
    }
    if (!mcpEntries && mcpResult) {
      mcpEntries = mcpResult.ok ? mcpResult.entries : [];
    }
    if (!systemEntries && systemResult) {
      systemEntries = systemResult.ok ? systemResult.entries : [];
    }
  }

  agentEntries ??= [];
  mcpEntries ??= [];
  systemEntries ??= [];

  let mcpServerCount = 0;
  let skillCount = 0;

  // Step 1: Sync healthy MCP servers to claude settings
  try {
    const healthyMcp = mcpEntries.filter((e) => e.health === "healthy" || e.health === "degraded");
    if (healthyMcp.length > 0) {
      // Write MCP config file
      const mcpServers = healthyMcp.map((e) => ({
        id: e.id,
        name: e.name,
        status: e.status as "RUNNING",
        tools: e.tools,
        createdAt: "",
      }));
      const mcpConfigPath = await writeMcpConfigFile({ workspaceDir, servers: mcpServers });
      log.debug(`wrote MCP config: ${mcpConfigPath}`);

      // Merge into .claude/settings.json
      const mcpConfig = buildMcpConfig(mcpServers);
      await syncMcpToClaudeSettings({ workspaceDir, mcpServers: mcpConfig.mcpServers });
      mcpServerCount = healthyMcp.length;
      log.debug(`synced ${mcpServerCount} MCP servers to claude settings`);
    }
  } catch (err) {
    log.warn(`MCP sync failed: ${String(err)}`);
  }

  // Step 2: Generate skills for agents + agent systems
  try {
    const targets = await buildSkillTargets(params, agentEntries, systemEntries);
    const skillsDir = path.join(workspaceDir, "skills");
    const result = await generateFabricSkills({ targets, skillsDir });
    skillCount = result.generated;
    log.debug(`generated ${result.generated} skills, cleaned ${result.cleaned} stale`);
  } catch (err) {
    log.warn(`skill generation failed: ${String(err)}`);
  }

  // Step 3: Re-sync skills to .claude/commands/
  try {
    await syncSkillsToClaudeCommands({ workspaceDir, config });
    log.debug("re-synced skills to claude commands");
  } catch (err) {
    log.warn(`skills re-sync failed: ${String(err)}`);
  }

  return { ok: true, mcpServers: mcpServerCount, skills: skillCount };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildSkillTargets(
  params: SyncFabricParams,
  agentEntries: AgentStatusEntry[],
  systemEntries: AgentSystemStatusEntry[],
): Promise<FabricSkillTarget[]> {
  const targets: FabricSkillTarget[] = [];
  const activeAgents = agentEntries.filter(
    (e) => e.health === "healthy" || e.health === "degraded",
  );
  const activeSystems = systemEntries.filter(
    (e) => e.health === "healthy" || e.health === "degraded",
  );

  // Try to enrich with detailed info (system prompts, tools)
  let client: CloudruSimpleClient | null = null;
  if (activeAgents.length > 0 || activeSystems.length > 0) {
    client = new CloudruSimpleClient({
      projectId: params.projectId,
      auth: params.auth,
    });
  }

  // Agents
  for (const entry of activeAgents) {
    const target: FabricSkillTarget = {
      id: entry.id,
      name: entry.name,
      kind: "agent",
    };

    // Try to fetch full agent details for systemPrompt + tools
    if (client) {
      try {
        const full = await client.getAgent(entry.id);
        target.description = full.description;
        target.systemPrompt = full.options?.systemPrompt;
        target.tools = full.options?.tools;
      } catch {
        // Use basic info from status entry
      }
    }

    targets.push(target);
  }

  // Agent Systems
  for (const entry of activeSystems) {
    const target: FabricSkillTarget = {
      id: entry.id,
      name: entry.name,
      description: entry.description,
      kind: "agent-system",
      memberCount: entry.memberCount,
    };

    if (client) {
      try {
        const full = await client.getAgentSystem(entry.id);
        target.description = full.description;
      } catch {
        // Use basic info
      }
    }

    targets.push(target);
  }

  return targets;
}
