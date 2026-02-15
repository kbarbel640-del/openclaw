import type { DatabaseSync } from "node:sqlite";
import type { OrgMembership, Person } from "./types.js";
import { buildEmbeddingText } from "./embeddings.js";

interface PeopleRow {
  id: string;
  name: string;
  primary_email: string;
  github_username: string | null;
  asana_gid: string | null;
  monday_id: string | null;
  last_synced: string;
  embedding_text: string | null;
}

interface OrgRow {
  person_id: string;
  org: string;
  role: string;
  department: string | null;
  slack_id: string | null;
  slack_display_name: string | null;
  slack_title: string | null;
  slack_status: string | null;
  slack_timezone: string | null;
  is_admin: number;
  is_active: number;
}

interface EmailRow {
  email: string;
  person_id: string;
}

function rowToPerson(row: PeopleRow, orgs: OrgRow[], emails: EmailRow[]): Person {
  return {
    id: row.id,
    name: row.name,
    primary_email: row.primary_email,
    emails: emails.map((e) => e.email),
    orgs: orgs.map(orgRowToMembership),
    ...(row.github_username ? { github_username: row.github_username } : {}),
    ...(row.asana_gid ? { asana_gid: row.asana_gid } : {}),
    ...(row.monday_id ? { monday_id: row.monday_id } : {}),
    last_synced: row.last_synced,
  };
}

function orgRowToMembership(row: OrgRow): OrgMembership {
  return {
    org: row.org as OrgMembership["org"],
    role: row.role,
    ...(row.department ? { department: row.department } : {}),
    ...(row.slack_id ? { slack_id: row.slack_id } : {}),
    ...(row.slack_display_name ? { slack_display_name: row.slack_display_name } : {}),
    ...(row.slack_title ? { slack_title: row.slack_title } : {}),
    ...(row.slack_status ? { slack_status: row.slack_status } : {}),
    ...(row.slack_timezone ? { slack_timezone: row.slack_timezone } : {}),
    is_admin: row.is_admin === 1,
    is_active: row.is_active === 1,
  };
}

function loadPersonById(db: DatabaseSync, personId: string): Person | null {
  const row = db.prepare("SELECT * FROM leo_people WHERE id = ?").get(personId) as
    | PeopleRow
    | undefined;
  if (!row) {
    return null;
  }

  const orgs = db
    .prepare("SELECT * FROM leo_people_orgs WHERE person_id = ?")
    .all(personId) as unknown as OrgRow[];
  const emails = db
    .prepare("SELECT * FROM leo_people_emails WHERE person_id = ?")
    .all(personId) as unknown as EmailRow[];

  return rowToPerson(row, orgs, emails);
}

export function upsertPerson(db: DatabaseSync, person: Person): void {
  const embeddingText = buildEmbeddingText(person);

  db.prepare(`
    INSERT INTO leo_people (id, name, primary_email, github_username, asana_gid, monday_id, last_synced, embedding_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(primary_email) DO UPDATE SET
      name = excluded.name,
      github_username = excluded.github_username,
      asana_gid = excluded.asana_gid,
      monday_id = excluded.monday_id,
      last_synced = excluded.last_synced,
      embedding_text = excluded.embedding_text
  `).run(
    person.id,
    person.name,
    person.primary_email.toLowerCase(),
    person.github_username ?? null,
    person.asana_gid ?? null,
    person.monday_id ?? null,
    person.last_synced,
    embeddingText,
  );

  // Resolve the actual stored ID (may differ if upsert matched existing)
  const stored = db
    .prepare("SELECT id FROM leo_people WHERE primary_email = ?")
    .get(person.primary_email.toLowerCase()) as { id: string } | undefined;
  const storedId = stored?.id ?? person.id;

  // Upsert emails
  const deleteEmails = db.prepare("DELETE FROM leo_people_emails WHERE person_id = ?");
  deleteEmails.run(storedId);

  const insertEmail = db.prepare(
    "INSERT OR IGNORE INTO leo_people_emails (email, person_id) VALUES (?, ?)",
  );
  for (const email of person.emails) {
    insertEmail.run(email.toLowerCase(), storedId);
  }

  // Upsert org memberships
  for (const org of person.orgs) {
    db.prepare(`
      INSERT INTO leo_people_orgs (person_id, org, role, department, slack_id, slack_display_name, slack_title, slack_status, slack_timezone, is_admin, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(person_id, org) DO UPDATE SET
        role = excluded.role,
        department = excluded.department,
        slack_id = excluded.slack_id,
        slack_display_name = excluded.slack_display_name,
        slack_title = excluded.slack_title,
        slack_status = excluded.slack_status,
        slack_timezone = excluded.slack_timezone,
        is_admin = excluded.is_admin,
        is_active = excluded.is_active
    `).run(
      storedId,
      org.org,
      org.role,
      org.department ?? null,
      org.slack_id ?? null,
      org.slack_display_name ?? null,
      org.slack_title ?? null,
      org.slack_status ?? null,
      org.slack_timezone ?? null,
      org.is_admin ? 1 : 0,
      org.is_active ? 1 : 0,
    );
  }
}

export function lookupByEmail(db: DatabaseSync, email: string): Person | null {
  const normalized = email.toLowerCase();

  // Check primary email first
  const directRow = db
    .prepare("SELECT id FROM leo_people WHERE LOWER(primary_email) = ?")
    .get(normalized) as { id: string } | undefined;
  if (directRow) {
    return loadPersonById(db, directRow.id);
  }

  // Check cross-reference emails table
  const emailRow = db
    .prepare("SELECT person_id FROM leo_people_emails WHERE LOWER(email) = ?")
    .get(normalized) as { person_id: string } | undefined;
  if (emailRow) {
    return loadPersonById(db, emailRow.person_id);
  }

  return null;
}

export function listByOrg(db: DatabaseSync, org: string, team?: string): Person[] {
  let rows: Array<{ person_id: string }>;
  if (team) {
    rows = db
      .prepare("SELECT DISTINCT person_id FROM leo_people_orgs WHERE org = ? AND department = ?")
      .all(org, team) as Array<{ person_id: string }>;
  } else {
    rows = db
      .prepare("SELECT DISTINCT person_id FROM leo_people_orgs WHERE org = ?")
      .all(org) as Array<{ person_id: string }>;
  }

  const people: Person[] = [];
  for (const row of rows) {
    const person = loadPersonById(db, row.person_id);
    if (person) {
      people.push(person);
    }
  }
  return people;
}

export function searchByName(db: DatabaseSync, query: string): Person[] {
  const pattern = `%${query.toLowerCase()}%`;
  const rows = db
    .prepare("SELECT id FROM leo_people WHERE LOWER(name) LIKE ?")
    .all(pattern) as Array<{ id: string }>;

  const people: Person[] = [];
  for (const row of rows) {
    const person = loadPersonById(db, row.id);
    if (person) {
      people.push(person);
    }
  }
  return people;
}

export function getAllPeople(db: DatabaseSync): Person[] {
  const rows = db.prepare("SELECT id FROM leo_people").all() as Array<{ id: string }>;

  const people: Person[] = [];
  for (const row of rows) {
    const person = loadPersonById(db, row.id);
    if (person) {
      people.push(person);
    }
  }
  return people;
}
