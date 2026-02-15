import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { requireNodeSqlite } from "../memory/sqlite.js";
import { ensurePeopleSchema } from "./schema.js";

function createTestDb(): DatabaseSync {
  const { DatabaseSync: DB } = requireNodeSqlite();
  return new DB(":memory:");
}

describe("ensurePeopleSchema", () => {
  it("creates all required tables", () => {
    const db = createTestDb();
    ensurePeopleSchema({ db });

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain("leo_people");
    expect(tableNames).toContain("leo_people_emails");
    expect(tableNames).toContain("leo_people_orgs");
  });

  it("creates leo_people table with correct columns", () => {
    const db = createTestDb();
    ensurePeopleSchema({ db });

    const columns = db.prepare("PRAGMA table_info(leo_people)").all() as Array<{ name: string }>;
    const colNames = columns.map((c) => c.name);

    expect(colNames).toContain("id");
    expect(colNames).toContain("name");
    expect(colNames).toContain("primary_email");
    expect(colNames).toContain("github_username");
    expect(colNames).toContain("asana_gid");
    expect(colNames).toContain("monday_id");
    expect(colNames).toContain("last_synced");
    expect(colNames).toContain("embedding_text");
  });

  it("creates leo_people_emails table with correct columns", () => {
    const db = createTestDb();
    ensurePeopleSchema({ db });

    const columns = db.prepare("PRAGMA table_info(leo_people_emails)").all() as Array<{
      name: string;
    }>;
    const colNames = columns.map((c) => c.name);

    expect(colNames).toContain("email");
    expect(colNames).toContain("person_id");
  });

  it("creates leo_people_orgs table with correct columns", () => {
    const db = createTestDb();
    ensurePeopleSchema({ db });

    const columns = db.prepare("PRAGMA table_info(leo_people_orgs)").all() as Array<{
      name: string;
    }>;
    const colNames = columns.map((c) => c.name);

    expect(colNames).toContain("person_id");
    expect(colNames).toContain("org");
    expect(colNames).toContain("role");
    expect(colNames).toContain("department");
    expect(colNames).toContain("slack_id");
    expect(colNames).toContain("slack_display_name");
    expect(colNames).toContain("slack_title");
    expect(colNames).toContain("slack_status");
    expect(colNames).toContain("slack_timezone");
    expect(colNames).toContain("is_admin");
    expect(colNames).toContain("is_active");
  });

  it("is idempotent (can be called twice)", () => {
    const db = createTestDb();
    ensurePeopleSchema({ db });
    expect(() => ensurePeopleSchema({ db })).not.toThrow();
  });
});
