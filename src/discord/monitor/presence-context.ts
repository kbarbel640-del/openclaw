import type { GatewayPresenceUpdate } from "discord-api-types/v10";
import { buildUntrustedChannelMetadata } from "../../security/channel-metadata.js";

const MAX_ACTIVITY_ENTRIES = 3;

const ACTIVITY_TYPE_LABELS: Record<number, string> = {
  0: "Playing",
  1: "Streaming",
  2: "Listening",
  3: "Watching",
  4: "Custom",
  5: "Competing",
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolveActivityLabel(activity: {
  type?: number;
  name?: string;
  state?: string | null;
  details?: string | null;
}): string | null {
  const typeLabel =
    typeof activity.type === "number"
      ? (ACTIVITY_TYPE_LABELS[activity.type] ?? `Activity ${activity.type}`)
      : "Activity";
  const name = normalizeText(activity.name);
  const details = normalizeText(activity.details);
  const state = normalizeText(activity.state);
  const headline = name || details || state;
  if (!headline) {
    return null;
  }
  const segments = [`${typeLabel}: ${headline}`];
  if (details && details !== headline) {
    segments.push(`details=${details}`);
  }
  if (state && state !== headline) {
    segments.push(`state=${state}`);
  }
  return segments.join(" | ");
}

export function buildDiscordPresenceMetadata(
  presence: GatewayPresenceUpdate | undefined,
): string | undefined {
  if (!presence) {
    return undefined;
  }

  const status = normalizeText(presence.status);
  const activities = (presence.activities ?? [])
    .map((activity) => resolveActivityLabel(activity))
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, MAX_ACTIVITY_ENTRIES);

  if (!status && activities.length === 0) {
    return undefined;
  }

  const entries = [
    status ? `Sender status: ${status}` : null,
    activities.length > 0 ? `Sender activities: ${activities.join("; ")}` : null,
  ].filter((entry): entry is string => Boolean(entry));

  return buildUntrustedChannelMetadata({
    source: "discord",
    label: "Discord sender presence (best-effort, may be stale)",
    entries,
  });
}
