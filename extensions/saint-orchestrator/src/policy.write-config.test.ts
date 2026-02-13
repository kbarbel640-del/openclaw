import { describe, expect, it } from "vitest";
import { canWritePath } from "./policy.js";
import type { ResolvedTier } from "./types.js";

function ownerTier(): ResolvedTier {
  return {
    tierName: "owner",
    contactSlug: "owner",
    source: "contact",
    tier: {
      tools: ["*"],
      memory_scope: ["shared", "private", "daily", "own_user", "all_users"],
      skills: "*",
      file_access: {
        read: ["*"],
        write: ["*"],
        deny_write: [],
      },
    },
  };
}

describe("canWritePath config guard", () => {
  it("allows config writes for owner tier (confirmation enforced in write/edit tools)", () => {
    const tier = ownerTier();
    expect(canWritePath(tier, "config/tiers.yaml")).toBe(true);
    expect(canWritePath(tier, "config/contacts.json")).toBe(true);
    expect(canWritePath(tier, "openclaw.json")).toBe(true);
    expect(canWritePath(tier, "openclaw.json5")).toBe(true);
  });

  it("keeps non-config owner writes allowed", () => {
    const tier = ownerTier();
    expect(canWritePath(tier, "memory/shared/notes.md")).toBe(true);
    expect(canWritePath(tier, "data/report.md")).toBe(true);
  });

  it("still denies config writes for non-owner tier defaults", () => {
    const tier: ResolvedTier = {
      tierName: "employee",
      contactSlug: "employee",
      source: "contact",
      tier: {
        tools: ["read", "write"],
        memory_scope: ["shared", "own_user"],
        skills: [],
        file_access: {
          read: ["memory/shared/*", "memory/users/employee/*"],
          write: ["memory/users/employee/*", "data/*"],
          deny_write: [],
        },
      },
    };

    expect(canWritePath(tier, "config/tiers.yaml")).toBe(false);
    expect(canWritePath(tier, "openclaw.json")).toBe(false);
  });
});
