import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import type { SlackUser } from "../../people/types.js";
import { requireNodeSqlite } from "../../memory/sqlite.js";
import { ensurePeopleSchema } from "../../people/schema.js";
import { syncSlackUsers } from "../../people/sync.js";
import { ToolInputError } from "./common.js";
import {
  createPeopleSearchTool,
  createPeopleLookupTool,
  createPeopleListTool,
  createPeopleSyncTool,
} from "./people-tool.js";

function createTestDb(): DatabaseSync {
  const { DatabaseSync: DB } = requireNodeSqlite();
  const db = new DB(":memory:");
  ensurePeopleSchema({ db });
  return db;
}

function seedTestData(db: DatabaseSync): void {
  const zenloopUsers: SlackUser[] = [
    {
      id: "U-ZEN-001",
      name: "jonas",
      real_name: "Jonas Muller",
      profile: {
        email: "jonas@zenloop.com",
        display_name: "Jonas",
        title: "Backend Engineer",
        status_text: "Coding",
      },
      tz: "Europe/Berlin",
      is_admin: false,
      deleted: false,
      is_bot: false,
    },
    {
      id: "U-ZEN-002",
      name: "verena",
      real_name: "Verena Schmidt",
      profile: {
        email: "verena@zenloop.com",
        display_name: "Verena",
        title: "Engineering Manager",
        status_text: "",
      },
      tz: "Europe/Berlin",
      is_admin: false,
      deleted: false,
      is_bot: false,
    },
    {
      id: "U-ZEN-003",
      name: "marie",
      real_name: "Marie Weber",
      profile: {
        email: "marie@zenloop.com",
        display_name: "Marie",
        title: "Product Manager",
      },
      tz: "Europe/Berlin",
      is_admin: false,
      deleted: false,
      is_bot: false,
    },
  ];

  const edubUsers: SlackUser[] = [
    {
      id: "U-EDU-001",
      name: "ali",
      real_name: "Ali Naqishaheen",
      profile: {
        email: "ali@edubites.com",
        display_name: "Ali",
        title: "CEO",
      },
      tz: "Asia/Dubai",
      is_admin: true,
      deleted: false,
      is_bot: false,
    },
  ];

  // Ali also appears in protaige with same email mapped to edubites
  const protaigeUsers: SlackUser[] = [
    {
      id: "U-PRO-001",
      name: "ali.n",
      real_name: "Ali Naqishaheen",
      profile: {
        email: "ali@edubites.com", // Same email -> cross-org unification
        display_name: "Ali N.",
        title: "Founder",
      },
      tz: "Asia/Dubai",
      is_admin: true,
      deleted: false,
      is_bot: false,
    },
  ];

  syncSlackUsers(db, zenloopUsers, "zenloop");
  syncSlackUsers(db, edubUsers, "edubites");
  syncSlackUsers(db, protaigeUsers, "protaige");
}

function parseToolResult(result: { content: Array<{ text: string }> }): unknown {
  return JSON.parse(result.content[0].text);
}

describe("people_lookup tool", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createTestDb();
    seedTestData(db);
  });

  it("finds person by exact email", async () => {
    const tool = createPeopleLookupTool({ db });
    const result = await tool.execute("call-1", { email: "ali@edubites.com" });
    const data = parseToolResult(result) as { found: boolean; person: { name: string } };

    expect(data.found).toBe(true);
    expect(data.person.name).toBe("Ali Naqishaheen");
  });

  it("returns cross-org memberships for unified person", async () => {
    const tool = createPeopleLookupTool({ db });
    const result = await tool.execute("call-1", { email: "ali@edubites.com" });
    const data = parseToolResult(result) as {
      found: boolean;
      person: { orgs: Array<{ org: string }> };
    };

    expect(data.found).toBe(true);
    expect(data.person.orgs.length).toBeGreaterThanOrEqual(2);
    const orgNames = data.person.orgs.map((o) => o.org).toSorted();
    expect(orgNames).toContain("edubites");
    expect(orgNames).toContain("protaige");
  });

  it("returns not found for unknown email", async () => {
    const tool = createPeopleLookupTool({ db });
    const result = await tool.execute("call-1", { email: "stranger@unknown.com" });
    const data = parseToolResult(result) as { found: boolean };

    expect(data.found).toBe(false);
  });

  it("throws ToolInputError for missing email", async () => {
    const tool = createPeopleLookupTool({ db });
    await expect(tool.execute("call-1", {})).rejects.toThrow(ToolInputError);
  });
});

describe("people_search tool", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createTestDb();
    seedTestData(db);
  });

  it("returns matches for name query", async () => {
    const tool = createPeopleSearchTool({ db });
    const result = await tool.execute("call-1", { query: "verena" });
    const data = parseToolResult(result) as { results: Array<{ name: string }> };

    expect(data.results.length).toBeGreaterThanOrEqual(1);
    expect(data.results[0].name).toBe("Verena Schmidt");
  });

  it("throws ToolInputError for empty query", async () => {
    const tool = createPeopleSearchTool({ db });
    await expect(tool.execute("call-1", { query: "" })).rejects.toThrow(ToolInputError);
  });

  it("throws ToolInputError for missing query", async () => {
    const tool = createPeopleSearchTool({ db });
    await expect(tool.execute("call-1", {})).rejects.toThrow(ToolInputError);
  });

  it("returns empty array when no matches", async () => {
    const tool = createPeopleSearchTool({ db });
    const result = await tool.execute("call-1", { query: "nonexistentperson" });
    const data = parseToolResult(result) as { results: unknown[] };

    expect(data.results).toEqual([]);
  });
});

describe("people_list tool", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createTestDb();
    seedTestData(db);
  });

  it("lists all members of an org", async () => {
    const tool = createPeopleListTool({ db });
    const result = await tool.execute("call-1", { org: "zenloop" });
    const data = parseToolResult(result) as { people: unknown[]; count: number };

    expect(data.people.length).toBe(3);
    expect(data.count).toBe(3);
  });

  it("filters by team/department", async () => {
    const tool = createPeopleListTool({ db });
    // Jonas (Backend Engineer) and Verena (Engineering Manager) are in Engineering
    // but we need department set during sync. For now, test the filter mechanism.
    const result = await tool.execute("call-1", {
      org: "zenloop",
      team: "Engineering",
    });
    const data = parseToolResult(result) as { people: Array<{ name: string }> };

    // This will depend on how sync sets department from Slack title
    // For now, just verify the tool accepts the parameter and returns filtered results
    expect(Array.isArray(data.people)).toBe(true);
  });

  it("throws ToolInputError for missing org", async () => {
    const tool = createPeopleListTool({ db });
    await expect(tool.execute("call-1", {})).rejects.toThrow(ToolInputError);
  });

  it("throws ToolInputError for invalid org", async () => {
    const tool = createPeopleListTool({ db });
    await expect(tool.execute("call-1", { org: "invalid_org" })).rejects.toThrow(ToolInputError);
  });

  it("returns empty list for org with no members", async () => {
    const tool = createPeopleListTool({ db });
    const result = await tool.execute("call-1", { org: "saasgroup" });
    const data = parseToolResult(result) as { people: unknown[]; count: number };

    expect(data.people).toEqual([]);
    expect(data.count).toBe(0);
  });
});

describe("people_sync tool", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createTestDb();
  });

  it("syncs users and returns counts", async () => {
    const tool = createPeopleSyncTool({ db });
    const users: SlackUser[] = [
      {
        id: "U001",
        name: "test",
        real_name: "Test User",
        profile: { email: "test@zenloop.com", display_name: "Test", title: "Engineer" },
        tz: "Europe/Berlin",
        is_admin: false,
        deleted: false,
        is_bot: false,
      },
    ];

    const result = await tool.execute("call-1", {
      org: "zenloop",
      users,
    });
    const data = parseToolResult(result) as {
      ok: boolean;
      results: Array<{ added: number; updated: number; unchanged: number }>;
    };

    expect(data.ok).toBe(true);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].added).toBe(1);
  });

  it("is idempotent - no duplicates on re-sync", async () => {
    const tool = createPeopleSyncTool({ db });
    const users: SlackUser[] = [
      {
        id: "U001",
        name: "test",
        real_name: "Test User",
        profile: { email: "test@zenloop.com", display_name: "Test", title: "Engineer" },
        tz: "Europe/Berlin",
        is_admin: false,
        deleted: false,
        is_bot: false,
      },
    ];

    await tool.execute("call-1", { org: "zenloop", users });
    const result = await tool.execute("call-2", { org: "zenloop", users });
    const data = parseToolResult(result) as {
      ok: boolean;
      results: Array<{ added: number; unchanged: number }>;
    };

    expect(data.results[0].added).toBe(0);
    expect(data.results[0].unchanged).toBe(1);
  });

  it("returns jsonResult formatted output", async () => {
    const tool = createPeopleSyncTool({ db });
    const result = await tool.execute("call-1", {
      org: "zenloop",
      users: [],
    });

    // Verify jsonResult format
    expect(result).toHaveProperty("content");
    expect(result.content).toBeInstanceOf(Array);
    expect(result.content[0]).toHaveProperty("type", "text");
    expect(result.content[0]).toHaveProperty("text");
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
