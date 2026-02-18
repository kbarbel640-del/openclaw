import {
  ActivityType,
  PresenceUpdateStatus,
  type PresenceUpdateReceiveStatus,
  type GatewayPresenceUpdate,
  type GatewayActivity,
} from "discord-api-types/v10";
import { describe, expect, it, vi } from "vitest";
import { __testing, buildDiscordPresenceMetadata } from "./presence-context.js";
import { PRESENCE_CONTEXT_LABEL, PRESENCE_MAX_ACTIVITY_ENTRIES } from "./presence.constants.js";

function createActivity(params: {
  id: string;
  name: string;
  type?: ActivityType;
  createdAt: number;
  details?: string;
  startMs?: number;
}): GatewayActivity {
  return {
    id: params.id,
    name: params.name,
    type: params.type ?? ActivityType.Playing,
    created_at: params.createdAt,
    details: params.details,
    timestamps: params.startMs ? { start: params.startMs } : undefined,
  };
}

function createPresence(params: {
  status: PresenceUpdateReceiveStatus;
  activities?: GatewayActivity[];
}): GatewayPresenceUpdate {
  return {
    guild_id: "123456789012345678",
    user: { id: "876543210987654321" },
    status: params.status,
    activities: params.activities ?? [],
  };
}

describe("presence-context helpers", () => {
  it("resolves known activity labels and falls back for unknown type", () => {
    expect(__testing.resolveActivityTypeLabel({ activityType: ActivityType.Playing })).toBe(
      "Playing",
    );
    expect(__testing.resolveActivityTypeLabel({ activityType: 99 })).toBe("Activity 99");
    expect(__testing.resolveActivityTypeLabel({ activityType: undefined })).toBe("Activity");
  });

  it("resolves activity duration from start/end timestamps", () => {
    const nowMs = Date.UTC(2026, 1, 18, 10, 0, 0);
    const activity = createActivity({
      id: "duration-test",
      name: "Game",
      createdAt: nowMs - 5000,
      startMs: nowMs - 5000,
    });
    expect(__testing.resolveActivityDurationMs({ activity, nowMs })).toBe(5000);

    const endedActivity = {
      ...activity,
      timestamps: {
        start: nowMs - 5000,
        end: nowMs - 1000,
      },
    };
    expect(__testing.resolveActivityDurationMs({ activity: endedActivity, nowMs })).toBe(4000);
  });

  it("returns undefined duration for invalid timestamps", () => {
    const nowMs = Date.UTC(2026, 1, 18, 10, 0, 0);
    const invalidActivity = {
      ...createActivity({
        id: "invalid-duration",
        name: "Game",
        createdAt: nowMs,
      }),
      timestamps: {
        start: Number.NaN,
      },
    };
    expect(
      __testing.resolveActivityDurationMs({ activity: invalidActivity, nowMs }),
    ).toBeUndefined();
  });

  it("builds presence metadata entry lines", () => {
    expect(
      __testing.resolvePresenceMetadataEntries({
        status: "idle",
        activities: ["Listening: Spotify"],
      }),
    ).toEqual(["Sender status: idle", "Sender activities: Listening: Spotify"]);
  });
});

describe("buildDiscordPresenceMetadata", () => {
  it("returns undefined when presence is missing", () => {
    expect(buildDiscordPresenceMetadata({})).toBeUndefined();
  });

  it("includes status, activity name and duration", () => {
    const nowMs = Date.UTC(2026, 1, 18, 10, 0, 0);
    const startMs = nowMs - 75_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(nowMs);
    let metadata: string | undefined;
    try {
      metadata = buildDiscordPresenceMetadata({
        presence: createPresence({
          status: PresenceUpdateStatus.Idle,
          activities: [
            createActivity({
              id: "activity-spotify",
              name: "Spotify",
              type: ActivityType.Listening,
              createdAt: startMs,
              details: "Lo-fi beats",
              startMs,
            }),
          ],
        }),
      });
    } finally {
      nowSpy.mockRestore();
    }

    expect(metadata).toContain(PRESENCE_CONTEXT_LABEL);
    expect(metadata).toContain("Sender status: idle");
    expect(metadata).toContain("Listening: Spotify");
    expect(metadata).toContain("details=Lo-fi beats");
    expect(metadata).toContain("duration=1m 15s");
  });

  it("limits activities to configured max entries", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 1, 18, 10, 0, 0));
    let metadata: string | undefined;
    try {
      const activities = Array.from({ length: PRESENCE_MAX_ACTIVITY_ENTRIES + 2 }, (_, index) => ({
        id: `activity-${index}`,
        name: `Game ${index}`,
        created_at: Date.now(),
        type: ActivityType.Playing,
      }));
      metadata = buildDiscordPresenceMetadata({
        presence: createPresence({
          status: PresenceUpdateStatus.DoNotDisturb,
          activities,
        }),
      });
    } finally {
      nowSpy.mockRestore();
    }

    expect(metadata).toContain(`Game ${PRESENCE_MAX_ACTIVITY_ENTRIES - 1}`);
    expect(metadata).not.toContain(`Game ${PRESENCE_MAX_ACTIVITY_ENTRIES}`);
  });

  it("caps activity summaries through helper", () => {
    const nowMs = Date.UTC(2026, 1, 18, 10, 0, 0);
    const summaries = __testing.resolvePresenceActivitySummaries({
      nowMs,
      activities: Array.from({ length: PRESENCE_MAX_ACTIVITY_ENTRIES + 5 }, (_, index) =>
        createActivity({
          id: `a-${index}`,
          name: `Game ${index}`,
          createdAt: nowMs,
        }),
      ),
    });
    expect(summaries).toHaveLength(PRESENCE_MAX_ACTIVITY_ENTRIES);
  });
});
