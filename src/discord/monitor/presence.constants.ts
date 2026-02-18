import { ActivityType } from "discord-api-types/v10";

export const PRESENCE_CONTEXT_LABEL = "Discord sender presence (best-effort, may be stale)";

export const PRESENCE_MAX_ACTIVITY_ENTRIES = 3;

export const ACTIVITY_LABEL = "Activity";

export const ACTIVITY_TYPE_LABELS: Partial<Record<ActivityType, string>> = {
  [ActivityType.Playing]: "Playing",
  [ActivityType.Streaming]: "Streaming",
  [ActivityType.Listening]: "Listening",
  [ActivityType.Watching]: "Watching",
  [ActivityType.Custom]: "Custom",
  [ActivityType.Competing]: "Competing",
};
