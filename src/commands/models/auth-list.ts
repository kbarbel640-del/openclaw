import type { RuntimeEnv } from "../../runtime.js";
import { resolveOpenClawAgentDir } from "../../agents/agent-paths.js";
import { resolveAgentDir } from "../../agents/agent-scope.js";
import {
  type AuthProfileStore,
  ensureAuthProfileStore,
  resolveAuthStorePathForDisplay,
} from "../../agents/auth-profiles.js";
import { normalizeProviderId } from "../../agents/model-selection.js";
import { loadConfig } from "../../config/config.js";
import { renderTable } from "../../terminal/table.js";
import { colorize, theme } from "../../terminal/theme.js";
import { shortenHomePath } from "../../utils.js";
import { type ProfileDisplayInfo, resolveProfileDisplayInfos } from "./list.auth-overview.js";
import { formatProfileStatus, isRich } from "./list.format.js";
import { ensureFlagCompatibility, resolveKnownAgentId } from "./shared.js";

function collectAllProviders(store: AuthProfileStore): string[] {
  const providers = new Set<string>();
  for (const cred of Object.values(store.profiles)) {
    if (cred.provider) {
      providers.add(normalizeProviderId(cred.provider));
    }
  }
  return Array.from(providers).toSorted((a, b) => a.localeCompare(b));
}

export async function modelsAuthListCommand(
  opts: {
    provider?: string;
    json?: boolean;
    plain?: boolean;
    agent?: string;
  },
  runtime: RuntimeEnv,
) {
  ensureFlagCompatibility(opts);

  const cfg = loadConfig();
  const agentId = resolveKnownAgentId({ cfg, rawAgentId: opts.agent });
  const agentDir = agentId ? resolveAgentDir(cfg, agentId) : resolveOpenClawAgentDir();
  const store = ensureAuthProfileStore(agentDir);
  const authStorePath = shortenHomePath(resolveAuthStorePathForDisplay(agentDir));

  const targetProviders = opts.provider
    ? [normalizeProviderId(opts.provider.trim())]
    : collectAllProviders(store);

  const allInfos: ProfileDisplayInfo[] = [];
  for (const provider of targetProviders) {
    const infos = resolveProfileDisplayInfos({ provider, cfg, store });
    allInfos.push(...infos);
  }

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          ...(agentId ? { agentId } : {}),
          agentDir,
          authStorePath,
          profiles: allInfos.map((info) => ({
            profileId: info.profileId,
            provider: info.provider,
            type: info.type,
            status: info.status,
            active: info.active,
            ...(info.email ? { email: info.email } : {}),
            ...(info.expiresAt !== undefined ? { expiresAt: info.expiresAt } : {}),
            ...(info.remainingMs !== undefined ? { remainingMs: info.remainingMs } : {}),
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (opts.plain) {
    for (const info of allInfos) {
      runtime.log(`${info.profileId}\t${info.provider}\t${info.type}\t${info.status}`);
    }
    return;
  }

  const rich = isRich(opts);

  runtime.log(
    `${colorize(rich, theme.heading, `Auth profiles (${allInfos.length})`)}  ${colorize(rich, theme.muted, `Store: ${authStorePath}`)}`,
  );

  if (allInfos.length === 0) {
    runtime.log(colorize(rich, theme.muted, "  (no profiles)"));
    return;
  }

  const tableWidth = Math.max(60, (process.stdout.columns ?? 120) - 1);
  const rows = allInfos.map((info) => {
    const activeMarker = info.active ? colorize(rich, theme.success, "*") : " ";
    return {
      Profile: `${colorize(rich, theme.accent, info.profileId)} ${activeMarker}`,
      Type: colorize(rich, theme.info, info.type),
      Provider: colorize(rich, theme.heading, info.provider),
      Status: formatProfileStatus(info.status, rich),
      Detail: info.detail
        ? colorize(rich, theme.muted, info.detail)
        : colorize(rich, theme.muted, "-"),
    };
  });

  runtime.log(
    renderTable({
      width: tableWidth,
      columns: [
        { key: "Profile", header: "Profile", minWidth: 20 },
        { key: "Type", header: "Type", minWidth: 8 },
        { key: "Provider", header: "Provider", minWidth: 12 },
        { key: "Status", header: "Status", minWidth: 10 },
        { key: "Detail", header: "Detail", minWidth: 12, flex: true },
      ],
      rows,
    }).trimEnd(),
  );
}
