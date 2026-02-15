import { describe, expect, it } from "vitest";
import type { Person } from "./types.js";
import { buildEmbeddingText } from "./embeddings.js";

describe("buildEmbeddingText", () => {
  it("concatenates name, role, department, org, and email", () => {
    const person: Person = {
      id: "test-1",
      name: "Jonas Muller",
      primary_email: "jonas@zenloop.com",
      emails: ["jonas@zenloop.com"],
      orgs: [
        {
          org: "zenloop",
          role: "Backend Engineer",
          department: "Engineering",
          is_admin: false,
          is_active: true,
        },
      ],
      last_synced: "2026-02-15T10:00:00Z",
    };

    const text = buildEmbeddingText(person);
    expect(text).toContain("Jonas Muller");
    expect(text).toContain("Backend Engineer");
    expect(text).toContain("Engineering");
    expect(text).toContain("zenloop");
    expect(text).toContain("jonas@zenloop.com");
  });

  it("includes all org roles for multi-org person", () => {
    const person: Person = {
      id: "test-2",
      name: "Ali Naqishaheen",
      primary_email: "ali@edubites.com",
      emails: ["ali@edubites.com", "ali@protaige.com"],
      orgs: [
        { org: "edubites", role: "CEO", department: "Leadership", is_admin: true, is_active: true },
        {
          org: "protaige",
          role: "Founder",
          department: "Leadership",
          is_admin: true,
          is_active: true,
        },
      ],
      last_synced: "2026-02-15T10:00:00Z",
    };

    const text = buildEmbeddingText(person);
    expect(text).toContain("CEO");
    expect(text).toContain("Founder");
    expect(text).toContain("edubites");
    expect(text).toContain("protaige");
  });

  it("handles person with no department gracefully", () => {
    const person: Person = {
      id: "test-3",
      name: "Test User",
      primary_email: "test@zenloop.com",
      emails: ["test@zenloop.com"],
      orgs: [
        {
          org: "zenloop",
          role: "Intern",
          is_admin: false,
          is_active: true,
        },
      ],
      last_synced: "2026-02-15T10:00:00Z",
    };

    const text = buildEmbeddingText(person);
    expect(text).toContain("Test User");
    expect(text).toContain("Intern");
    expect(text).not.toContain("undefined");
  });
});
