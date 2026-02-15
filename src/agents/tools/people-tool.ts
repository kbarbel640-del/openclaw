import type { DatabaseSync } from "node:sqlite";
import { Type } from "@sinclair/typebox";
import type { OrgName, SlackUser } from "../../people/types.js";
import type { AnyAgentTool } from "./common.js";
import { lookupByEmail, listByOrg, searchByName } from "../../people/store.js";
import { syncSlackUsers } from "../../people/sync.js";
import { VALID_ORGS } from "../../people/types.js";
import { jsonResult, readStringParam, ToolInputError } from "./common.js";

const PeopleLookupSchema = Type.Object({
  email: Type.String(),
});

const PeopleSearchSchema = Type.Object({
  query: Type.String(),
});

const PeopleListSchema = Type.Object({
  org: Type.String(),
  team: Type.Optional(Type.String()),
});

const PeopleSyncSchema = Type.Object({
  org: Type.String(),
  users: Type.Array(Type.Unknown()),
});

export function createPeopleLookupTool(options: { db: DatabaseSync }): AnyAgentTool {
  const { db } = options;
  return {
    label: "People Lookup",
    name: "people_lookup",
    description:
      "Look up a person by email address. Returns their profile with cross-org memberships.",
    parameters: PeopleLookupSchema,
    execute: async (_toolCallId, params) => {
      const email = readStringParam(params, "email", { required: true });
      const person = lookupByEmail(db, email);
      if (!person) {
        return jsonResult({ found: false });
      }
      return jsonResult({ found: true, person });
    },
  };
}

export function createPeopleSearchTool(options: { db: DatabaseSync }): AnyAgentTool {
  const { db } = options;
  return {
    label: "People Search",
    name: "people_search",
    description: "Search for people by name. Returns matching profiles.",
    parameters: PeopleSearchSchema,
    execute: async (_toolCallId, params) => {
      const query = readStringParam(params, "query", { required: true });
      const results = searchByName(db, query);
      return jsonResult({ results });
    },
  };
}

export function createPeopleListTool(options: { db: DatabaseSync }): AnyAgentTool {
  const { db } = options;
  return {
    label: "People List",
    name: "people_list",
    description:
      "List all people in a specific organization. Optionally filter by team/department.",
    parameters: PeopleListSchema,
    execute: async (_toolCallId, params) => {
      const org = readStringParam(params, "org", { required: true });
      if (!VALID_ORGS.includes(org as OrgName)) {
        throw new ToolInputError(`Invalid org: ${org}. Must be one of: ${VALID_ORGS.join(", ")}`);
      }
      const team = readStringParam(params, "team");
      const people = listByOrg(db, org, team);
      return jsonResult({ people, count: people.length });
    },
  };
}

export function createPeopleSyncTool(options: { db: DatabaseSync }): AnyAgentTool {
  const { db } = options;
  return {
    label: "People Sync",
    name: "people_sync",
    description: "Sync Slack users into the people directory for a specific organization.",
    parameters: PeopleSyncSchema,
    execute: async (_toolCallId, params) => {
      const org = readStringParam(params, "org", { required: true });
      if (!VALID_ORGS.includes(org as OrgName)) {
        throw new ToolInputError(`Invalid org: ${org}. Must be one of: ${VALID_ORGS.join(", ")}`);
      }
      const users = (params.users ?? []) as SlackUser[];
      const result = syncSlackUsers(db, users, org as OrgName);
      return jsonResult({ ok: true, results: [result] });
    },
  };
}
