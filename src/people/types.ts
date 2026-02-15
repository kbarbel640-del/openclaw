export type OrgName = "edubites" | "protaige" | "zenloop" | "saasgroup";

export const VALID_ORGS: readonly OrgName[] = [
  "edubites",
  "protaige",
  "zenloop",
  "saasgroup",
] as const;

export interface Person {
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

export interface OrgMembership {
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

export interface SyncResult {
  added: number;
  updated: number;
  unchanged: number;
  org?: OrgName;
}

export interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  profile?: {
    email?: string;
    display_name?: string;
    title?: string;
    status_text?: string;
  };
  tz?: string;
  is_admin?: boolean;
  deleted?: boolean;
  is_bot?: boolean;
}
