# Feature: People Index

## Priority: 1 (Foundation)

## Status: Spec Written

## Description

A cross-org people directory implemented as OpenClaw agent tools (`people_search`,
`people_lookup`, `people_list`, `people_sync`) that enable Leo to identify anyone
across the four organizations (edubites, protaige, zenloop, saasgroup).

The index stores person records in a SQLite database using OpenClaw's existing
`node:sqlite` infrastructure (`src/memory/sqlite.ts`) with vector embeddings via
`sqlite-vec` (`src/memory/sqlite-vec.ts`) for semantic search. The primary
cross-reference key is email address: the same person appearing in multiple Slack
workspaces is unified into a single profile.

Each tool follows OpenClaw's tool conventions:

- Exported as `createPeople{Action}Tool()` factory functions
- Returns `AnyAgentTool` (from `src/agents/tools/common.ts`)
- Uses `@sinclair/typebox` for parameter schemas
- Uses `readStringParam`/`readNumberParam` helpers from `common.ts`
- Returns results via `jsonResult()` helper
- Colocated tests in `*.test.ts` files

## Acceptance Criteria

1. `people_search` with query "Jonas" returns matching people with org, role, team
2. `people_lookup` with email "jonas@zenloop.com" returns full unified profile
3. `people_list` with org="zenloop" returns all zenloop members
4. `people_list` with org="zenloop" and team="engineering" filters by department
5. `people_sync` ingests Slack user data and returns added/updated/unchanged counts
6. Cross-org unification: person in both edubites + protaige Slack has single profile
7. Unknown email lookup returns `{ found: false }` result
8. Semantic search for "backend engineers" returns people with matching roles
9. Running `people_sync` twice produces no duplicates (idempotent)
10. All tools return `jsonResult()` formatted output

## Test Cases

| #   | Test                            | Input                                                  | Expected Output                                                                     |
| --- | ------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 1   | Exact email lookup finds person | `people_lookup({ email: "ali@edubites.com" })`         | `{ found: true, person: { name: "Ali", ... } }`                                     |
| 2   | Unknown email returns not found | `people_lookup({ email: "stranger@unknown.com" })`     | `{ found: false }`                                                                  |
| 3   | Name search returns matches     | `people_search({ query: "verena" })`                   | Array with Verena's profile                                                         |
| 4   | Semantic role search works      | `people_search({ query: "backend engineers" })`        | People with engineering roles                                                       |
| 5   | List by org returns members     | `people_list({ org: "zenloop" })`                      | All zenloop members                                                                 |
| 6   | List by org+team filters        | `people_list({ org: "zenloop", team: "engineering" })` | Only engineering dept members                                                       |
| 7   | Cross-org unification by email  | Sync person in 2 workspaces with same email            | Single person record, 2 org memberships                                             |
| 8   | Sync idempotency                | Run sync twice with same data                          | Same count, no duplicates                                                           |
| 9   | Sync returns counts             | `people_sync()`                                        | `{ added: N, updated: M, unchanged: K }`                                            |
| 10  | Sync single org                 | `people_sync({ org: "zenloop" })`                      | Only zenloop users synced                                                           |
| 11  | Empty query returns error       | `people_search({ query: "" })`                         | ToolInputError thrown                                                               |
| 12  | Invalid org returns error       | `people_list({ org: "invalid" })`                      | ToolInputError thrown                                                               |
| 13  | Schema creates tables on init   | Open fresh DB                                          | `leo_people`, `leo_people_emails`, `leo_people_orgs`, `leo_people_vec` tables exist |
| 14  | Embedding text built correctly  | Person with name+role+org                              | Concatenated embedding text matches expected format                                 |

## Dependencies

- None (this is the foundation layer)

## Files

### New files to create

- `src/people/schema.ts` — SQLite schema creation (`ensurePeopleSchema()`)
- `src/people/types.ts` — TypeScript interfaces (Person, OrgMembership, SlackProfile)
- `src/people/store.ts` — CRUD operations on the people SQLite tables
- `src/people/embeddings.ts` — Embedding text generation and vector search
- `src/people/sync.ts` — Slack sync logic (ingest users, unify by email)
- `src/people/index.ts` — Public API barrel export
- `src/agents/tools/people-tool.ts` — Tool factory functions
- `src/agents/tools/people-tool.test.ts` — Unit tests

### Files to modify

- `src/agents/openclaw-tools.ts` — Register people tools in `createOpenClawTools()`

## Data Model

### SQLite Tables

```sql
-- Main people table
CREATE TABLE IF NOT EXISTS leo_people (
  id TEXT PRIMARY KEY,              -- UUID
  name TEXT NOT NULL,
  primary_email TEXT NOT NULL UNIQUE,
  github_username TEXT,
  asana_gid TEXT,
  monday_id TEXT,
  last_synced TEXT NOT NULL,        -- ISO 8601 timestamp
  embedding_text TEXT               -- Text used to generate embedding
);

-- Email cross-reference (supports multiple emails per person)
CREATE TABLE IF NOT EXISTS leo_people_emails (
  email TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES leo_people(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_people_emails_person ON leo_people_emails(person_id);

-- Org memberships (one per org per person)
CREATE TABLE IF NOT EXISTS leo_people_orgs (
  person_id TEXT NOT NULL REFERENCES leo_people(id) ON DELETE CASCADE,
  org TEXT NOT NULL,                -- edubites|protaige|zenloop|saasgroup
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

-- Vector embeddings (sqlite-vec virtual table)
CREATE VIRTUAL TABLE IF NOT EXISTS leo_people_vec USING vec0(
  person_id TEXT PRIMARY KEY,
  embedding float[1536]
);
```

### TypeScript Interfaces

```typescript
type OrgName = "edubites" | "protaige" | "zenloop" | "saasgroup";

interface Person {
  id: string;
  name: string;
  primary_email: string;
  emails: string[];
  orgs: OrgMembership[];
  github_username?: string;
  asana_gid?: string;
  monday_id?: string;
  last_synced: string;
}

interface OrgMembership {
  org: OrgName;
  role: string;
  department?: string;
  slack_id?: string;
  slack_display_name?: string;
  slack_title?: string;
  slack_status?: string;
  slack_timezone?: string;
  is_admin: boolean;
  is_active: boolean;
}

interface SyncResult {
  added: number;
  updated: number;
  unchanged: number;
  org?: OrgName;
}
```

## Tool Specifications

### `people_search`

- **Name:** `people_search`
- **Label:** "People Search"
- **Description:** "Search the people directory by name, email, role, team, or any keyword. Uses semantic search to find relevant matches."
- **Parameters:** `{ query: string, maxResults?: number }`
- **Schema:** `Type.Object({ query: Type.String(), maxResults: Type.Optional(Type.Number()) })`
- **Returns:** `jsonResult({ results: Person[] })`

### `people_lookup`

- **Name:** `people_lookup`
- **Label:** "People Lookup"
- **Description:** "Look up a person by exact email address. Returns their full cross-org profile if found."
- **Parameters:** `{ email: string }`
- **Schema:** `Type.Object({ email: Type.String() })`
- **Returns:** `jsonResult({ found: true, person: Person })` or `jsonResult({ found: false })`

### `people_list`

- **Name:** `people_list`
- **Label:** "People List"
- **Description:** "List all people in a specific organization, optionally filtered by team/department."
- **Parameters:** `{ org: string, team?: string }`
- **Schema:** `Type.Object({ org: Type.String(), team: Type.Optional(Type.String()) })`
- **Returns:** `jsonResult({ people: Person[], count: number })`

### `people_sync`

- **Name:** `people_sync`
- **Label:** "People Sync"
- **Description:** "Sync the people directory from Slack workspace user directories. Unifies profiles across orgs by email address."
- **Parameters:** `{ org?: string }`
- **Schema:** `Type.Object({ org: Type.Optional(Type.String()) })`
- **Returns:** `jsonResult({ ok: true, results: SyncResult[] })`

## Sync Strategy

- **Full sync:** Triggered by `people_sync()` with no args — iterates all 4 workspaces
- **Single org sync:** Triggered by `people_sync({ org: "zenloop" })` — one workspace only
- **Unification:** After ingesting Slack users, match by email to merge into existing person records
- **Idempotency:** Uses `primary_email` as unique key; upserts on conflict

## Notes

- Tool names use underscores (not dots) per OpenClaw convention: `people_search`, not `people.search`
- Embedding dimension 1536 matches OpenAI `text-embedding-3-small` default
- The sync tool does NOT call external APIs directly in this iteration; it receives pre-fetched Slack user data. External API integration is a separate concern handled by the Slack reader feature.
- For testing, we use in-memory SQLite databases with `sqlite-vec` loaded
- The `people_sync` tool accepts a `users` parameter (array of raw Slack user objects) for testability
- Per AGENTS.md, avoid `Type.Union` in tool schemas; use `Type.String()` for org and validate in the handler

## Blocks

- All other Leo features benefit from the people index for person identification
