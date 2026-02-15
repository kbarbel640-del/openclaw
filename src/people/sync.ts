import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type { OrgMembership, OrgName, Person, SlackUser, SyncResult } from "./types.js";
import { upsertPerson, lookupByEmail } from "./store.js";

function slackUserToOrgMembership(user: SlackUser, org: OrgName): OrgMembership {
  return {
    org,
    role: user.profile?.title ?? "",
    ...(user.profile?.display_name ? { slack_display_name: user.profile.display_name } : {}),
    ...(user.profile?.title ? { slack_title: user.profile.title } : {}),
    ...(user.profile?.status_text ? { slack_status: user.profile.status_text } : {}),
    ...(user.tz ? { slack_timezone: user.tz } : {}),
    slack_id: user.id,
    is_admin: user.is_admin === true,
    is_active: true,
  };
}

function orgMembershipChanged(existing: OrgMembership, incoming: OrgMembership): boolean {
  return (
    existing.role !== incoming.role ||
    existing.slack_display_name !== incoming.slack_display_name ||
    existing.slack_title !== incoming.slack_title ||
    existing.slack_status !== incoming.slack_status ||
    existing.slack_timezone !== incoming.slack_timezone ||
    existing.slack_id !== incoming.slack_id ||
    existing.is_admin !== incoming.is_admin ||
    existing.is_active !== incoming.is_active
  );
}

export function syncSlackUsers(db: DatabaseSync, users: SlackUser[], org: OrgName): SyncResult {
  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const user of users) {
    // Skip bots, deleted users, users without email
    if (user.is_bot) {
      continue;
    }
    if (user.deleted) {
      continue;
    }
    const email = user.profile?.email;
    if (!email) {
      continue;
    }

    const existing = lookupByEmail(db, email);
    const membership = slackUserToOrgMembership(user, org);

    if (!existing) {
      // New person
      const person: Person = {
        id: randomUUID(),
        name: user.real_name ?? user.name,
        primary_email: email,
        emails: [email],
        orgs: [membership],
        last_synced: new Date().toISOString(),
      };
      upsertPerson(db, person);
      added++;
    } else {
      // Check if this org membership already exists
      const existingOrg = existing.orgs.find((o) => o.org === org);

      if (existingOrg && !orgMembershipChanged(existingOrg, membership)) {
        unchanged++;
      } else {
        // Update: either new org membership or changed data
        const otherOrgs = existing.orgs.filter((o) => o.org !== org);
        const updatedPerson: Person = {
          ...existing,
          name: user.real_name ?? user.name,
          orgs: [...otherOrgs, membership],
          last_synced: new Date().toISOString(),
        };
        upsertPerson(db, updatedPerson);
        updated++;
      }
    }
  }

  return { added, updated, unchanged, org };
}
