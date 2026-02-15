import { listChannelPluginCatalogEntries } from "../channels/plugins/catalog.js";
import { CHAT_CHANNEL_ORDER } from "../channels/registry.js";

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const resolved: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    resolved.push(value);
  }
  return resolved;
}

export function resolveCliChannelOptions(): string[] {
  const catalog = listChannelPluginCatalogEntries().map((entry) => entry.id);
  return dedupe([...CHAT_CHANNEL_ORDER, ...catalog]);
}

export function formatCliChannelOptions(extra: string[] = []): string {
  return [...extra, ...resolveCliChannelOptions()].join("|");
}
