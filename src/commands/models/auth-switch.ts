import { isCancel, select as clackSelect } from "@clack/prompts";
import type { RuntimeEnv } from "../../runtime.js";
import { resolveOpenClawAgentDir } from "../../agents/agent-paths.js";
import { resolveAgentDir } from "../../agents/agent-scope.js";
import {
  ensureAuthProfileStore,
  listProfilesForProvider,
  setAuthProfileOrder,
} from "../../agents/auth-profiles.js";
import { normalizeProviderId } from "../../agents/model-selection.js";
import { loadConfig } from "../../config/config.js";
import { stylePromptHint, stylePromptMessage } from "../../terminal/prompt-style.js";
import { resolveProfileDisplayInfos } from "./list.auth-overview.js";
import { resolveKnownAgentId } from "./shared.js";

export async function modelsAuthSwitchCommand(
  opts: {
    provider: string;
    profile?: string;
    agent?: string;
  },
  runtime: RuntimeEnv,
) {
  const provider = normalizeProviderId(opts.provider.trim());
  const cfg = loadConfig();
  const agentId = resolveKnownAgentId({ cfg, rawAgentId: opts.agent });
  const agentDir = agentId ? resolveAgentDir(cfg, agentId) : resolveOpenClawAgentDir();
  const store = ensureAuthProfileStore(agentDir);

  const profileIds = listProfilesForProvider(store, provider);
  if (profileIds.length === 0) {
    throw new Error(`No auth profiles found for provider "${provider}".`);
  }

  const displayInfos = resolveProfileDisplayInfos({ provider, cfg, store });
  const displayMap = new Map(displayInfos.map((info) => [info.profileId, info]));

  let selectedProfileId: string;

  if (opts.profile) {
    // Non-interactive mode
    const targetId = opts.profile.trim();
    if (!profileIds.includes(targetId)) {
      throw new Error(
        `Auth profile "${targetId}" not found for provider "${provider}". Available: ${profileIds.join(", ")}`,
      );
    }
    selectedProfileId = targetId;
  } else {
    // Interactive mode — use clack select
    const options = profileIds.map((profileId) => {
      const info = displayMap.get(profileId);
      const parts: string[] = [];
      if (info) {
        parts.push(info.type);
        parts.push(info.status);
        if (info.email) {
          parts.push(info.email);
        }
      }
      const hint = parts.length > 0 ? parts.join(" · ") : undefined;
      return {
        value: profileId,
        label: profileId,
        hint,
      };
    });

    const result = await clackSelect({
      message: stylePromptMessage(`Select active auth profile for ${provider}`),
      options: options.map((opt) =>
        opt.hint === undefined ? opt : { ...opt, hint: stylePromptHint(opt.hint) },
      ),
    });

    if (isCancel(result)) {
      runtime.log("Cancelled.");
      return;
    }

    selectedProfileId = String(result);
  }

  // Build new order: selected profile first, then remaining profiles
  const newOrder = [selectedProfileId, ...profileIds.filter((id) => id !== selectedProfileId)];

  const updated = await setAuthProfileOrder({
    agentDir,
    provider,
    order: newOrder,
  });

  if (!updated) {
    throw new Error("Failed to update auth-profiles.json (lock busy?).");
  }

  const info = displayMap.get(selectedProfileId);
  const detail = info ? ` (${info.type}${info.email ? `, ${info.email}` : ""})` : "";
  runtime.log(`Switched ${provider} active profile to ${selectedProfileId}${detail}`);
}
