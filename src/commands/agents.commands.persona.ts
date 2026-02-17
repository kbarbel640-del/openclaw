import { writeConfigFile } from "../config/config.js";
import { logConfigUpdated } from "../config/logging.js";
import { normalizeAgentId } from "../routing/session-key.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { requireValidConfig } from "./agents.command-shared.js";
import { findAgentEntryIndex, listAgentEntries } from "./agents.config.js";

type AgentsSetPersonaOptions = {
  agent?: string;
  persona?: string;
  clear?: boolean;
  json?: boolean;
};

const coerceTrimmed = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export async function agentsSetPersonaCommand(
  opts: AgentsSetPersonaOptions,
  runtime: RuntimeEnv = defaultRuntime,
) {
  const cfg = await requireValidConfig(runtime);
  if (!cfg) {
    return;
  }

  const agentRaw = coerceTrimmed(opts.agent);
  if (!agentRaw) {
    runtime.error("Select an agent with --agent.");
    runtime.exit(1);
    return;
  }
  const agentId = normalizeAgentId(agentRaw);

  const wantsClear = Boolean(opts.clear);
  const persona = wantsClear ? undefined : coerceTrimmed(opts.persona);
  if (!wantsClear && !persona) {
    runtime.error("Set --persona <key> or pass --clear.");
    runtime.exit(1);
    return;
  }

  const list = listAgentEntries(cfg);
  const index = findAgentEntryIndex(list, agentId);
  const base = index >= 0 ? list[index] : { id: agentId };

  const nextEntry = wantsClear ? { ...base, persona: undefined } : { ...base, persona };

  const nextList = [...list];
  if (index >= 0) {
    nextList[index] = nextEntry;
  } else {
    nextList.push(nextEntry);
  }

  const nextConfig = {
    ...cfg,
    agents: {
      ...cfg.agents,
      list: nextList,
    },
  };

  await writeConfigFile(nextConfig);

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          agentId,
          persona: wantsClear ? null : persona,
          cleared: wantsClear,
        },
        null,
        2,
      ),
    );
    return;
  }

  logConfigUpdated(runtime);
  runtime.log(`Agent: ${agentId}`);
  runtime.log(wantsClear ? "Persona: (cleared)" : `Persona: ${persona}`);
}
