/**
 * Provider list command implementation.
 * Lists all known LLM providers with their detection status.
 */

import type { RuntimeEnv } from "../../runtime.js";
import { defaultRuntime } from "../../runtime.js";
import { renderTable, type TableColumn } from "../../terminal/table.js";
import { theme, isRich } from "../../terminal/theme.js";
import { detectProviders, type DetectionOptions } from "./detection.js";
import type { ProviderStatus } from "./types.js";

export type ProvidersListOptions = {
  /** Output as JSON */
  json?: boolean;
  /** Plain output (no colors/formatting) */
  plain?: boolean;
  /** Show all providers including not detected */
  all?: boolean;
  /** Filter by provider ID */
  provider?: string;
};

export async function providersListCommand(
  opts: ProvidersListOptions,
  runtime: RuntimeEnv = defaultRuntime,
): Promise<void> {
  const detectionOpts: DetectionOptions = {
    includeNotDetected: opts.all ?? false,
    providerIds: opts.provider ? [opts.provider] : undefined,
  };

  const providers = detectProviders(detectionOpts);

  if (opts.json) {
    runtime.log(JSON.stringify(providers, null, 2));
    return;
  }

  if (opts.plain) {
    for (const provider of providers) {
      const status = provider.detected ? "detected" : "not_detected";
      const source = provider.authSource ?? "-";
      const detail = provider.authDetail ?? "-";
      runtime.log(`${provider.id}\t${provider.name}\t${status}\t${source}\t${detail}`);
    }
    return;
  }

  if (providers.length === 0) {
    runtime.log(theme.muted("No providers detected. Use --all to show all known providers."));
    return;
  }

  const rich = isRich();
  const rows = providers.map((p) => formatProviderRow(p, rich));

  const columns: TableColumn[] = [
    { key: "id", header: "Provider", minWidth: 16 },
    { key: "name", header: "Name", minWidth: 18 },
    { key: "status", header: "Status", minWidth: 14 },
    { key: "source", header: "Auth Source", minWidth: 12 },
    { key: "token", header: "Token", minWidth: 14 },
    { key: "detail", header: "Detail", minWidth: 16, flex: true },
  ];

  const table = renderTable({ columns, rows, border: "none" });
  runtime.log(table);

  // Summary
  const detected = providers.filter((p) => p.detected).length;
  const total = providers.length;
  runtime.log("");
  runtime.log(theme.muted(`${detected} of ${total} providers detected`));
}

function formatProviderRow(provider: ProviderStatus, rich: boolean): Record<string, string> {
  const statusText = provider.detected ? "✓ detected" : "✗ not detected";
  const status = rich
    ? provider.detected
      ? theme.success(statusText)
      : theme.muted(statusText)
    : statusText;

  const source = provider.authSource ?? "-";
  const detail = provider.authDetail ?? "-";

  // Format token validity
  let tokenStatus = "-";
  if (provider.detected && provider.tokenValidity) {
    if (provider.tokenValidity === "valid") {
      tokenStatus = provider.tokenExpiresIn
        ? rich
          ? theme.success(`✓ ${provider.tokenExpiresIn}`)
          : `valid (${provider.tokenExpiresIn})`
        : rich
          ? theme.success("✓ valid")
          : "valid";
    } else if (provider.tokenValidity === "expiring") {
      tokenStatus = provider.tokenExpiresIn
        ? rich
          ? theme.warn(`⚠ ${provider.tokenExpiresIn}`)
          : `expiring (${provider.tokenExpiresIn})`
        : rich
          ? theme.warn("⚠ expiring")
          : "expiring";
    } else if (provider.tokenValidity === "expired") {
      tokenStatus = rich ? theme.error("✗ expired") : "expired";
    }
  }

  return {
    id: rich ? theme.accent(provider.id) : provider.id,
    name: provider.name,
    status,
    source,
    detail: rich && detail !== "-" ? theme.info(detail) : detail,
    token: tokenStatus,
  };
}
