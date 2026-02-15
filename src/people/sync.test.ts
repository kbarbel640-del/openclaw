import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import type { SlackUser } from "./types.js";
import { requireNodeSqlite } from "../memory/sqlite.js";
import { ensurePeopleSchema } from "./schema.js";
import { lookupByEmail, getAllPeople } from "./store.js";
import { syncSlackUsers } from "./sync.js";

function createTestDb(): DatabaseSync {
  const { DatabaseSync: DB } = requireNodeSqlite();
  const db = new DB(":memory:");
  ensurePeopleSchema({ db });
  return db;
}

function makeSlackUser(overrides: Partial<SlackUser> = {}): SlackUser {
  return {
    id: "U001",
    name: "jonas",
    real_name: "Jonas Muller",
    profile: {
      email: "jonas@zenloop.com",
      display_name: "Jonas",
      title: "Backend Engineer",
      status_text: "In the zone",
    },
    tz: "Europe/Berlin",
    is_admin: false,
    deleted: false,
    is_bot: false,
    ...overrides,
  };
}

describe("syncSlackUsers", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createTestDb();
  });

  it("adds new users and returns correct counts", () => {
    const users: SlackUser[] = [
      makeSlackUser(),
      makeSlackUser({
        id: "U002",
        name: "verena",
        real_name: "Verena Schmidt",
        profile: {
          email: "verena@zenloop.com",
          display_name: "Verena",
          title: "Engineering Manager",
        },
      }),
    ];

    const result = syncSlackUsers(db, users, "zenloop");
    expect(result.added).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(0);
    expect(result.org).toBe("zenloop");
  });

  it("updates existing users when data changes", () => {
    const user = makeSlackUser();
    syncSlackUsers(db, [user], "zenloop");

    const updatedUser = makeSlackUser({
      profile: {
        email: "jonas@zenloop.com",
        display_name: "Jonas M.",
        title: "Senior Backend Engineer",
      },
    });
    const result = syncSlackUsers(db, [updatedUser], "zenloop");
    expect(result.updated).toBe(1);
    expect(result.added).toBe(0);
  });

  it("reports unchanged when syncing identical data", () => {
    const user = makeSlackUser();
    syncSlackUsers(db, [user], "zenloop");

    const result = syncSlackUsers(db, [user], "zenloop");
    expect(result.unchanged).toBe(1);
    expect(result.added).toBe(0);
    expect(result.updated).toBe(0);
  });

  it("is idempotent - no duplicates after multiple syncs", () => {
    const users = [makeSlackUser()];
    syncSlackUsers(db, users, "zenloop");
    syncSlackUsers(db, users, "zenloop");

    const all = getAllPeople(db);
    expect(all).toHaveLength(1);
  });

  it("unifies cross-org person by email", () => {
    // Same person in two different workspaces
    const zenloopUser = makeSlackUser({
      id: "U-ZEN-001",
      profile: {
        email: "jonas@zenloop.com",
        display_name: "Jonas",
        title: "Backend Engineer",
      },
    });
    const protaigeUser = makeSlackUser({
      id: "U-PRO-001",
      name: "jonas.muller",
      real_name: "Jonas Muller",
      profile: {
        email: "jonas@zenloop.com", // Same email
        display_name: "Jonas M.",
        title: "Consultant",
      },
    });

    syncSlackUsers(db, [zenloopUser], "zenloop");
    syncSlackUsers(db, [protaigeUser], "protaige");

    // Should be a single person with 2 org memberships
    const person = lookupByEmail(db, "jonas@zenloop.com");
    expect(person).not.toBeNull();
    expect(person!.orgs).toHaveLength(2);
    const orgNames = person!.orgs.map((o) => o.org).toSorted();
    expect(orgNames).toEqual(["protaige", "zenloop"]);
  });

  it("skips bots", () => {
    const users = [
      makeSlackUser(),
      makeSlackUser({
        id: "U-BOT",
        name: "slackbot",
        is_bot: true,
        profile: { email: "bot@zenloop.com" },
      }),
    ];

    const result = syncSlackUsers(db, users, "zenloop");
    expect(result.added).toBe(1);
    expect(getAllPeople(db)).toHaveLength(1);
  });

  it("skips deleted users", () => {
    const users = [
      makeSlackUser(),
      makeSlackUser({
        id: "U-DEL",
        name: "former",
        deleted: true,
        profile: { email: "former@zenloop.com" },
      }),
    ];

    const result = syncSlackUsers(db, users, "zenloop");
    expect(result.added).toBe(1);
  });

  it("skips users without email", () => {
    const users = [
      makeSlackUser(),
      makeSlackUser({
        id: "U-NOEMAIL",
        name: "noemail",
        profile: { display_name: "No Email" },
      }),
    ];

    const result = syncSlackUsers(db, users, "zenloop");
    expect(result.added).toBe(1);
  });

  it("syncs single org without affecting other orgs", () => {
    const zenloopUser = makeSlackUser();
    const edubUser = makeSlackUser({
      id: "U-EDU-001",
      name: "marie",
      real_name: "Marie Weber",
      profile: {
        email: "marie@edubites.com",
        display_name: "Marie",
        title: "Product Manager",
      },
    });

    syncSlackUsers(db, [zenloopUser], "zenloop");
    syncSlackUsers(db, [edubUser], "edubites");

    const all = getAllPeople(db);
    expect(all).toHaveLength(2);
  });
});
