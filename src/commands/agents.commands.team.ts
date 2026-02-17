import type { OpenClawConfig } from "../config/config.js";
import { writeConfigFile } from "../config/config.js";
import { logConfigUpdated } from "../config/logging.js";
import { normalizeAgentId } from "../routing/session-key.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { requireValidConfig } from "./agents.command-shared.js";
import { findAgentEntryIndex, listAgentEntries } from "./agents.config.js";

function ensureAgentExists(cfg: OpenClawConfig, agentId: string): OpenClawConfig {
  const list = listAgentEntries(cfg);
  const index = findAgentEntryIndex(list, agentId);
  if (index >= 0) {
    return cfg;
  }
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      list: [...list, { id: agentId }],
    },
  };
}

function parseMembers(raw: string[]): string[] {
  const out: string[] = [];
  for (const item of raw) {
    const parts = item
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    out.push(...parts);
  }
  const normalized = out.map((id) => normalizeAgentId(id)).filter(Boolean);
  return Array.from(new Set(normalized));
}

export async function agentsTeamSetCommand(
  opts: { agent: string; members: string[] },
  runtime: RuntimeEnv = defaultRuntime,
) {
  const cfg = await requireValidConfig(runtime);
  if (!cfg) {
    return;
  }

  const agentId = normalizeAgentId(opts.agent);
  const members = parseMembers(opts.members);
  if (members.length === 0) {
    runtime.error(
      "No members provided. Pass --member <id> (repeatable) or a comma-separated list.",
    );
    runtime.exit(1);
    return;
  }

  const withAgent = ensureAgentExists(cfg, agentId);
  const list = listAgentEntries(withAgent);
  const index = findAgentEntryIndex(list, agentId);
  const current = index >= 0 ? list[index] : { id: agentId };

  const nextEntry = {
    ...current,
    subagents: {
      ...current.subagents,
      allowAgents: members,
    },
  };
  const nextList = [...list];
  if (index >= 0) {
    nextList[index] = nextEntry;
  } else {
    nextList.push(nextEntry);
  }

  const nextConfig: OpenClawConfig = {
    ...withAgent,
    agents: {
      ...withAgent.agents,
      list: nextList,
    },
  };

  await writeConfigFile(nextConfig);
  logConfigUpdated(runtime);
  runtime.log(`Team updated for agent "${agentId}": ${members.join(", ")}`);
}

export async function agentsTeamClearCommand(
  opts: { agent: string },
  runtime: RuntimeEnv = defaultRuntime,
) {
  const cfg = await requireValidConfig(runtime);
  if (!cfg) {
    return;
  }
  const agentId = normalizeAgentId(opts.agent);
  const list = listAgentEntries(cfg);
  const index = findAgentEntryIndex(list, agentId);
  if (index < 0) {
    runtime.error(`Agent "${agentId}" not found.`);
    runtime.exit(1);
    return;
  }

  const current = list[index];
  const subagents = current.subagents;
  if (!subagents?.allowAgents || subagents.allowAgents.length === 0) {
    runtime.log(`Agent "${agentId}" has no configured team members.`);
    return;
  }

  const nextEntry = { ...current, subagents: { ...subagents, allowAgents: undefined } };
  const nextList = [...list];
  nextList[index] = nextEntry;

  const nextConfig: OpenClawConfig = {
    ...cfg,
    agents: {
      ...cfg.agents,
      list: nextList,
    },
  };

  await writeConfigFile(nextConfig);
  logConfigUpdated(runtime);
  runtime.log(`Team cleared for agent "${agentId}".`);
}
