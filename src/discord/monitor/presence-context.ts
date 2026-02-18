import type { GatewayActivity, GatewayPresenceUpdate } from "discord-api-types/v10";
import { formatDurationCompact } from "../../infra/format-time/format-duration.ts";
import { buildUntrustedChannelMetadata } from "../../security/channel-metadata.js";
import {
  ACTIVITY_LABEL,
  PRESENCE_CONTEXT_LABEL,
  PRESENCE_MAX_ACTIVITY_ENTRIES,
  ACTIVITY_TYPE_LABELS,
} from "./presence.constants.js";

const normalizeTimestamp = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

/**
 * Resolve a human label for a Discord activity type.
 *
 * @param params.activityType Discord activity type integer.
 * @returns Human-readable activity type label.
 * @see https://discord.com/developers/docs/events/gateway-events#activity-object-activity-types
 */
type ResolveActivityTypeLabelProps = {
  activityType?: number;
};

const resolveActivityTypeLabel = ({ activityType }: ResolveActivityTypeLabelProps): string => {
  if (typeof activityType !== "number") {
    return ACTIVITY_LABEL;
  }

  const known = ACTIVITY_TYPE_LABELS[activityType as keyof typeof ACTIVITY_TYPE_LABELS];

  return known ?? `${ACTIVITY_LABEL} ${activityType}`;
};

/**
 * Resolve activity duration in milliseconds when a start timestamp exists.
 *
 * @param params.activity Discord activity payload.
 * @param params.nowMs Current timestamp in milliseconds.
 * @returns Duration in milliseconds or undefined when unavailable.
 * @see https://discord.com/developers/docs/events/gateway-events#activity-object-activity-timestamps
 * @see https://discord.js.org/docs/packages/discord.js/main/Activity:Class
 */
type ResolveActivityDurationMsProps = {
  activity: GatewayActivity;
  nowMs: number;
};

const resolveActivityDurationMs = ({
  activity,
  nowMs,
}: ResolveActivityDurationMsProps): number | undefined => {
  const startedAtMs = normalizeTimestamp(activity.timestamps?.start);
  const endedAtMs = normalizeTimestamp(activity.timestamps?.end);

  if (startedAtMs === undefined) {
    return undefined;
  }

  return Math.max(0, (endedAtMs ?? nowMs) - startedAtMs);
};

/**
 * Formats one Discord activity entry from presence updates.
 *
 * @param params.activity Activity item from Discord presence payload.
 * @param params.nowMs Current timestamp in milliseconds.
 * @returns Formatted activity summary string.
 * @see https://discord.com/developers/docs/events/gateway-events#presence-update
 * @see https://discord.com/developers/docs/events/gateway-events#activity-object
 * @see https://discord.js.org/docs/packages/discord.js/main/Presence:Class
 */
type ResolveActivityLabelProps = {
  activity: GatewayActivity;
  nowMs: number;
};

const resolveActivityLabel = ({
  activity,
  nowMs,
}: ResolveActivityLabelProps): string | undefined => {
  const typeLabel = resolveActivityTypeLabel({ activityType: activity.type });

  const name = activity.name.trim();
  const details = activity.details?.trim() ?? "";
  const state = activity.state?.trim() ?? "";

  const headline = name || details || state;

  if (!headline) {
    return undefined;
  }

  const durationMs = resolveActivityDurationMs({ activity, nowMs });

  const duration = formatDurationCompact(durationMs, { spaced: true });

  const segments = [`${typeLabel}: ${headline}`];

  if (details && details !== headline) {
    segments.push(`details=${details}`);
  }

  if (state && state !== headline) {
    segments.push(`state=${state}`);
  }

  if (duration) {
    segments.push(`duration=${duration}`);
  }

  return segments.join(" | ");
};

/**
 * Build bounded formatted activity summaries from presence activities.
 *
 * @param params.activities Raw Discord activity list.
 * @param params.nowMs Current timestamp in milliseconds.
 * @returns Formatted activity summaries capped by configured max entries.
 */
type ResolvePresenceActivitySummariesProps = {
  activities?: GatewayActivity[];
  nowMs: number;
};

const resolvePresenceActivitySummaries = ({
  activities = [],
  nowMs,
}: ResolvePresenceActivitySummariesProps): string[] =>
  activities
    .map((activity) => resolveActivityLabel({ activity, nowMs }))
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, PRESENCE_MAX_ACTIVITY_ENTRIES);

/**
 * Build untrusted metadata lines for sender status + activities.
 *
 * @param params.status Presence status string.
 * @param params.activities Formatted activity summaries.
 * @returns Non-empty metadata lines.
 */
type ResolvePresenceMetadataEntriesProps = {
  status?: string;
  activities: string[];
};

const resolvePresenceMetadataEntries = ({
  status,
  activities,
}: ResolvePresenceMetadataEntriesProps): string[] =>
  [
    status ? `Sender status: ${status}` : undefined,
    activities.length > 0 ? `Sender activities: ${activities.join("; ")}` : undefined,
  ].filter((entry): entry is string => Boolean(entry));

type BuildDiscordPresenceMetadataParams = {
  presence?: GatewayPresenceUpdate;
};

/**
 * Convert Discord presence payload into a safe, untrusted metadata block.
 *
 * @param params.presence Discord gateway presence update payload.
 * @returns Wrapped untrusted metadata block or undefined when no useful presence data exists.
 * @see https://discord.com/developers/docs/events/gateway-events#presence-update
 */
export const buildDiscordPresenceMetadata = ({
  presence,
}: BuildDiscordPresenceMetadataParams): string | undefined => {
  if (!presence) {
    return undefined;
  }

  const nowMs = Date.now();
  const status = presence.status?.trim() ?? "";

  const activities = resolvePresenceActivitySummaries({
    activities: presence.activities,
    nowMs,
  });

  if (!status && activities.length === 0) {
    return undefined;
  }

  const entries = resolvePresenceMetadataEntries({ status, activities });

  return buildUntrustedChannelMetadata({
    source: "discord",
    label: PRESENCE_CONTEXT_LABEL,
    entries,
  });
};

export const __testing = {
  resolveActivityTypeLabel,
  resolveActivityDurationMs,
  resolvePresenceActivitySummaries,
  resolvePresenceMetadataEntries,
};
