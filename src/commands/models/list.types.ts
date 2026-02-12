import type { CredentialKind } from "../../agents/auth-profiles.js";

export type ConfiguredEntry = {
  key: string;
  ref: { provider: string; model: string };
  tags: Set<string>;
  aliases: string[];
};

export type ModelRow = {
  key: string;
  name: string;
  input: string;
  contextWindow: number | null;
  local: boolean | null;
  available: boolean | null;
  tags: string[];
  missing: boolean;
};

export type ProfileKindInfo = {
  kind: CredentialKind | "missing";
  /** Human-readable label, e.g. "OAuth (Max)", "API Key" */
  kindLabel: string;
  /** Optional billing-context hint, e.g. "Max" */
  billingHint?: string;
};

export type ProviderAuthOverview = {
  provider: string;
  effective: {
    kind: "profiles" | "env" | "models.json" | "missing";
    detail: string;
  };
  profiles: {
    count: number;
    oauth: number;
    token: number;
    apiKey: number;
    labels: string[];
    /** Per-profile credential kind info (same order as `labels`). */
    kinds: ProfileKindInfo[];
  };
  env?: { value: string; source: string; credentialKind?: ProfileKindInfo };
  modelsJson?: { value: string; source: string };
};
