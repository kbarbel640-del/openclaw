import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import type { OrgMembership, Person } from "./types.js";
import { requireNodeSqlite } from "../memory/sqlite.js";
import { ensurePeopleSchema } from "./schema.js";
import { upsertPerson, lookupByEmail, listByOrg, searchByName, getAllPeople } from "./store.js";

function createTestDb(): DatabaseSync {
  const { DatabaseSync: DB } = requireNodeSqlite();
  const db = new DB(":memory:");
  ensurePeopleSchema({ db });
  return db;
}

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: "test-uuid-1",
    name: "Ali Naqishaheen",
    primary_email: "ali@edubites.com",
    emails: ["ali@edubites.com", "ali@protaige.com", "ali@zenloop.com"],
    orgs: [
      {
        org: "edubites",
        role: "CEO",
        department: "Leadership",
        slack_id: "U001",
        slack_display_name: "Ali",
        slack_title: "CEO",
        is_admin: true,
        is_active: true,
      },
      {
        org: "protaige",
        role: "Founder",
        department: "Leadership",
        slack_id: "U002",
        slack_display_name: "Ali N",
        slack_title: "Founder",
        is_admin: true,
        is_active: true,
      },
      {
        org: "zenloop",
        role: "Board Member",
        department: "Advisory",
        slack_id: "U003",
        slack_display_name: "Ali",
        slack_title: "Board",
        is_admin: false,
        is_active: true,
      },
    ],
    last_synced: "2026-02-15T10:00:00Z",
    ...overrides,
  };
}

describe("people store", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createTestDb();
  });

  describe("upsertPerson", () => {
    it("inserts a new person", () => {
      const person = makePerson();
      upsertPerson(db, person);

      const result = lookupByEmail(db, "ali@edubites.com");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Ali Naqishaheen");
      expect(result!.primary_email).toBe("ali@edubites.com");
    });

    it("stores all email addresses", () => {
      const person = makePerson();
      upsertPerson(db, person);

      // All three emails should resolve to the same person
      const r1 = lookupByEmail(db, "ali@edubites.com");
      const r2 = lookupByEmail(db, "ali@protaige.com");
      const r3 = lookupByEmail(db, "ali@zenloop.com");
      expect(r1!.id).toBe(r2!.id);
      expect(r2!.id).toBe(r3!.id);
    });

    it("stores org memberships", () => {
      const person = makePerson();
      upsertPerson(db, person);

      const result = lookupByEmail(db, "ali@edubites.com");
      expect(result!.orgs).toHaveLength(3);
      const orgNames = result!.orgs.map((o: OrgMembership) => o.org).toSorted();
      expect(orgNames).toEqual(["edubites", "protaige", "zenloop"]);
    });

    it("updates existing person on re-upsert", () => {
      const person = makePerson();
      upsertPerson(db, person);

      const updated = makePerson({ name: "Ali N. Updated" });
      upsertPerson(db, updated);

      const result = lookupByEmail(db, "ali@edubites.com");
      expect(result!.name).toBe("Ali N. Updated");
    });

    it("does not create duplicates on re-upsert", () => {
      const person = makePerson();
      upsertPerson(db, person);
      upsertPerson(db, person);

      const all = getAllPeople(db);
      expect(all).toHaveLength(1);
    });
  });

  describe("lookupByEmail", () => {
    it("finds person by primary email", () => {
      upsertPerson(db, makePerson());
      const result = lookupByEmail(db, "ali@edubites.com");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Ali Naqishaheen");
    });

    it("finds person by secondary email", () => {
      upsertPerson(db, makePerson());
      const result = lookupByEmail(db, "ali@protaige.com");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Ali Naqishaheen");
    });

    it("returns null for unknown email", () => {
      upsertPerson(db, makePerson());
      const result = lookupByEmail(db, "stranger@unknown.com");
      expect(result).toBeNull();
    });

    it("is case-insensitive", () => {
      upsertPerson(db, makePerson());
      const result = lookupByEmail(db, "ALI@EDUBITES.COM");
      expect(result).not.toBeNull();
    });
  });

  describe("listByOrg", () => {
    it("returns all members of an org", () => {
      upsertPerson(db, makePerson());
      upsertPerson(
        db,
        makePerson({
          id: "test-uuid-2",
          name: "Verena Schmidt",
          primary_email: "verena@zenloop.com",
          emails: ["verena@zenloop.com"],
          orgs: [
            {
              org: "zenloop",
              role: "Engineering Manager",
              department: "Engineering",
              slack_id: "U010",
              slack_display_name: "Verena",
              slack_title: "EM",
              is_admin: false,
              is_active: true,
            },
          ],
        }),
      );

      const zenloopMembers = listByOrg(db, "zenloop");
      expect(zenloopMembers.length).toBeGreaterThanOrEqual(2);
    });

    it("filters by department when team is specified", () => {
      upsertPerson(
        db,
        makePerson({
          id: "test-uuid-2",
          name: "Verena Schmidt",
          primary_email: "verena@zenloop.com",
          emails: ["verena@zenloop.com"],
          orgs: [
            {
              org: "zenloop",
              role: "Engineering Manager",
              department: "Engineering",
              slack_id: "U010",
              slack_display_name: "Verena",
              slack_title: "EM",
              is_admin: false,
              is_active: true,
            },
          ],
        }),
      );
      upsertPerson(
        db,
        makePerson({
          id: "test-uuid-3",
          name: "Jonas Muller",
          primary_email: "jonas@zenloop.com",
          emails: ["jonas@zenloop.com"],
          orgs: [
            {
              org: "zenloop",
              role: "Backend Engineer",
              department: "Engineering",
              slack_id: "U011",
              slack_display_name: "Jonas",
              slack_title: "Backend",
              is_admin: false,
              is_active: true,
            },
          ],
        }),
      );
      upsertPerson(
        db,
        makePerson({
          id: "test-uuid-4",
          name: "Marie Weber",
          primary_email: "marie@zenloop.com",
          emails: ["marie@zenloop.com"],
          orgs: [
            {
              org: "zenloop",
              role: "Product Manager",
              department: "Product",
              slack_id: "U012",
              slack_display_name: "Marie",
              slack_title: "PM",
              is_admin: false,
              is_active: true,
            },
          ],
        }),
      );

      const engineers = listByOrg(db, "zenloop", "Engineering");
      expect(engineers).toHaveLength(2);
      const names = engineers.map((p: Person) => p.name).toSorted();
      expect(names).toEqual(["Jonas Muller", "Verena Schmidt"]);
    });

    it("returns empty array for org with no members", () => {
      const result = listByOrg(db, "saasgroup");
      expect(result).toEqual([]);
    });
  });

  describe("searchByName", () => {
    it("finds person by partial name match", () => {
      upsertPerson(db, makePerson());
      upsertPerson(
        db,
        makePerson({
          id: "test-uuid-2",
          name: "Verena Schmidt",
          primary_email: "verena@zenloop.com",
          emails: ["verena@zenloop.com"],
          orgs: [
            {
              org: "zenloop",
              role: "EM",
              department: "Engineering",
              is_admin: false,
              is_active: true,
            },
          ],
        }),
      );

      const results = searchByName(db, "verena");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Verena Schmidt");
    });

    it("is case-insensitive", () => {
      upsertPerson(db, makePerson());
      const results = searchByName(db, "ALI");
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it("returns empty array for no matches", () => {
      upsertPerson(db, makePerson());
      const results = searchByName(db, "nonexistent");
      expect(results).toEqual([]);
    });
  });
});
