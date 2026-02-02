import { describe, expect, it, vi } from "vitest";
import { discoverTeammates, formatTeammateRoster, type TeammateInfo } from "./teammates.js";

describe("discoverTeammates", () => {
  it("filters out non-bot users and self", async () => {
    const mockClient = {
      users: {
        list: vi.fn().mockResolvedValue({
          ok: true,
          members: [
            { id: "U001", name: "human-user", is_bot: false, deleted: false },
            {
              id: "U002",
              name: "data-bot",
              is_bot: true,
              deleted: false,
              profile: { display_name: "Data Bot" },
            },
            {
              id: "U003",
              name: "self-bot",
              is_bot: true,
              deleted: false,
              profile: { display_name: "Self" },
            },
            { id: "U004", name: "deleted-bot", is_bot: true, deleted: true },
          ],
        }),
      },
    };

    const result = await discoverTeammates({
      client: mockClient as any,
      token: "test-token",
      selfUserId: "U003",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      userId: "U002",
      name: "data-bot",
      displayName: "Data Bot",
      isBot: true,
      deleted: false,
    });
  });

  it("returns empty array on API error", async () => {
    const mockClient = {
      users: {
        list: vi.fn().mockRejectedValue(new Error("API error")),
      },
    };

    const result = await discoverTeammates({
      client: mockClient as any,
      token: "test-token",
      selfUserId: "U001",
    });

    expect(result).toEqual([]);
  });

  it("handles pagination", async () => {
    const mockClient = {
      users: {
        list: vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            members: [
              {
                id: "U001",
                name: "bot1",
                is_bot: true,
                deleted: false,
                profile: { display_name: "Bot 1" },
              },
            ],
            response_metadata: { next_cursor: "cursor123" },
          })
          .mockResolvedValueOnce({
            ok: true,
            members: [
              {
                id: "U002",
                name: "bot2",
                is_bot: true,
                deleted: false,
                profile: { display_name: "Bot 2" },
              },
            ],
          }),
      },
    };

    const result = await discoverTeammates({
      client: mockClient as any,
      token: "test-token",
      selfUserId: "U999",
    });

    expect(result).toHaveLength(2);
    expect(mockClient.users.list).toHaveBeenCalledTimes(2);
  });
});

describe("formatTeammateRoster", () => {
  it("formats teammate list correctly", () => {
    const teammates: TeammateInfo[] = [
      { userId: "U001", name: "bot1", displayName: "Bot One", isBot: true, deleted: false },
      { userId: "U002", name: "bot2", displayName: "", isBot: true, deleted: false },
    ];

    const result = formatTeammateRoster(teammates);
    expect(result).toContain("## Your Teammates");
    expect(result).toContain("@bot1 (U001): Bot One");
    expect(result).toContain("@bot2 (U002): Bot user");
  });

  it("returns empty string for no teammates", () => {
    expect(formatTeammateRoster([])).toBe("");
  });
});
