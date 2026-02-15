import type { DatabaseSync } from "node:sqlite";

export function ensurePeopleSchema(params: { db: DatabaseSync }): void {
  const { db } = params;

  db.exec(`
    CREATE TABLE IF NOT EXISTS leo_people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      primary_email TEXT NOT NULL UNIQUE,
      github_username TEXT,
      asana_gid TEXT,
      monday_id TEXT,
      last_synced TEXT NOT NULL,
      embedding_text TEXT
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS leo_people_emails (
      email TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES leo_people(id) ON DELETE CASCADE
    );
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_people_emails_person ON leo_people_emails(person_id);");

  db.exec(`
    CREATE TABLE IF NOT EXISTS leo_people_orgs (
      person_id TEXT NOT NULL REFERENCES leo_people(id) ON DELETE CASCADE,
      org TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      department TEXT,
      slack_id TEXT,
      slack_display_name TEXT,
      slack_title TEXT,
      slack_status TEXT,
      slack_timezone TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (person_id, org)
    );
  `);
}
