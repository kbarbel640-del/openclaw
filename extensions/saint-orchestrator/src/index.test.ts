import { describe, expect, it } from "vitest";
import { __testing } from "../index.js";

describe("saint-orchestrator helpers", () => {
  it("derives deterministic external slug", () => {
    const first = __testing.resolveExternalSlug({
      messageProvider: "whatsapp",
      senderE164: "+1 (555) 123-4567",
    });
    const second = __testing.resolveExternalSlug({
      messageProvider: "whatsapp",
      senderE164: "+15551234567",
    });

    expect(first).toBe("whatsapp-+15551234567");
    expect(second).toBe(first);
  });

  it("flags tier ceiling violations", () => {
    const errors = __testing.validateTierAgainstCeiling({
      tierName: "external.effective",
      tier: {
        tools: ["web_search", "exec"],
        memory_scope: ["own_user"],
        skills: [],
        max_budget_usd: 0.5,
      },
      ceiling: {
        tools: ["web_search", "web_fetch"],
        memory_scope: ["own_user"],
        skills: [],
        max_budget_usd: 0.5,
      },
    });

    expect(errors).toContain("external.effective: tools exceed ceiling");
  });

  it("rejects tiers yaml that exceeds fixed external ceiling", () => {
    const validation = __testing.validateTiersPayload(`
fixed:
  external:
    ceiling:
      tools: [web_search, web_fetch]
      memory_scope: [own_user]
      skills: []
      max_budget_usd: 0.5
    effective:
      tools: [web_search, web_fetch, exec]
      memory_scope: [own_user]
      skills: []
      max_budget_usd: 0.5
`);

    expect(validation.ok).toBe(false);
    expect(validation.errors.join("\n")).toContain(
      "fixed.external.effective: tools exceed ceiling",
    );
  });

  it("rejects contacts payload with unknown tiers", () => {
    const validation = __testing.validateContactsPayload({
      content: JSON.stringify(
        {
          contacts: [
            {
              slug: "ana",
              tier: "owner",
            },
            {
              slug: "marko",
              tier: "unknown",
            },
          ],
        },
        null,
        2,
      ),
      knownTierNames: new Set(["owner", "external", "manager", "employee"]),
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors.join("\n")).toContain(
      "contacts[1].tier references unknown tier (unknown)",
    );
  });

  it("rejects contacts payload with unsafe slugs", () => {
    const validation = __testing.validateContactsPayload({
      content: JSON.stringify(
        {
          contacts: [
            {
              slug: "../owner",
              tier: "owner",
            },
          ],
        },
        null,
        2,
      ),
      knownTierNames: new Set(["owner", "external", "manager", "employee"]),
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors.join("\n")).toContain(
      "contacts[0].slug must match ^[a-z0-9][a-z0-9_-]{0,63}$ (../owner)",
    );
  });

  it("requires confirmation token for config writes and accepts valid retry", () => {
    const first = __testing.requireWriteConfirmation({
      workspaceDir: "/tmp/ws",
      sessionKey: "agent:main",
      relPath: "config/tiers.yaml",
      contentHash: "abc",
    });
    expect(first.ok).toBe(false);
    const token = first.errors[0]?.split("confirmToken: ")[1];
    expect(token).toBeTruthy();

    const second = __testing.requireWriteConfirmation({
      workspaceDir: "/tmp/ws",
      sessionKey: "agent:main",
      relPath: "config/tiers.yaml",
      contentHash: "abc",
      confirmToken: token,
    });
    expect(second.ok).toBe(true);
  });

  it("filters sessions payload for non-owner tiers", () => {
    const filtered = __testing.filterSessionsPayloadByTier({
      payload: {
        count: 2,
        sessions: [
          { key: "agent:main:direct:employee-john" },
          { key: "agent:main:direct:owner-ana" },
        ],
      },
      tier: {
        tierName: "employee",
        contactSlug: "employee-john",
        tier: {
          tools: ["sessions_list", "sessions_history"],
          sessions_scope: "own",
        },
        source: "contact",
      },
    });

    expect(Array.isArray(filtered.sessions)).toBe(true);
    expect((filtered.sessions as Array<{ key: string }>).map((entry) => entry.key)).toEqual([
      "agent:main:direct:employee-john",
    ]);
  });

  it("does not match short slugs as substrings of session key segments", () => {
    // "al" should NOT match "agent:main:direct:alice" — the old includes() logic allowed this
    const filtered = __testing.filterSessionsPayloadByTier({
      payload: {
        count: 2,
        sessions: [{ key: "agent:main:direct:alice" }, { key: "agent:main:direct:al" }],
      },
      tier: {
        tierName: "employee",
        contactSlug: "al",
        tier: {
          tools: ["sessions_list", "sessions_history"],
          sessions_scope: "own",
        },
        source: "contact",
      },
    });

    expect((filtered.sessions as Array<{ key: string }>).map((entry) => entry.key)).toEqual([
      "agent:main:direct:al",
    ]);
  });

  it("matches slugs with hyphens, underscores, and slashes in session keys", () => {
    const filtered = __testing.filterSessionsPayloadByTier({
      payload: {
        count: 3,
        sessions: [
          { key: "agent:main:direct:team_lead-bob" },
          { key: "agent:main:direct:bob" },
          { key: "agent:main:direct:other" },
        ],
      },
      tier: {
        tierName: "manager",
        contactSlug: "team_lead-bob",
        tier: {
          tools: ["sessions_list"],
          sessions_scope: "own",
        },
        source: "contact",
      },
    });

    expect((filtered.sessions as Array<{ key: string }>).map((entry) => entry.key)).toEqual([
      "agent:main:direct:team_lead-bob",
    ]);
  });

  it("includes model field in fallback tier configs", () => {
    expect(__testing.FALLBACK_OWNER_CEILING.model).toBe("claude-sonnet-4-5");
    expect(__testing.FALLBACK_EXTERNAL_CEILING.model).toBe("claude-haiku-4-5");
    expect(__testing.FALLBACK_CUSTOM.manager?.model).toBe("claude-sonnet-4-5");
    expect(__testing.FALLBACK_CUSTOM.employee?.model).toBe("claude-haiku-4-5");
  });

  it("preserves model through mergeTier", () => {
    const base = { tools: [], model: "claude-sonnet-4-5" };
    const overlay = { tools: ["exec"] };
    const merged = __testing.mergeTier(base, overlay);
    expect(merged.model).toBe("claude-sonnet-4-5");

    const overridden = __testing.mergeTier(base, { tools: [], model: "claude-haiku-4-5" });
    expect(overridden.model).toBe("claude-haiku-4-5");
  });

  it("includes COMPANY.md in manager inject list", () => {
    const manager = __testing.FALLBACK_CUSTOM.manager;
    expect(manager?.system_prompt_includes?.inject).toContain("COMPANY.md");
  });

  it("gives manager sessions_scope 'all'", () => {
    const manager = __testing.FALLBACK_CUSTOM.manager;
    expect(manager?.sessions_scope).toBe("all");
  });

  it("allows manager to see all sessions with sessions_scope 'all'", () => {
    const filtered = __testing.filterSessionsPayloadByTier({
      payload: {
        count: 3,
        sessions: [
          { key: "agent:main:direct:manager-bob" },
          { key: "agent:main:direct:employee-john" },
          { key: "agent:main:direct:owner-ana" },
        ],
      },
      tier: {
        tierName: "manager",
        contactSlug: "manager-bob",
        tier: {
          tools: ["sessions_list"],
          sessions_scope: "all",
        },
        source: "contact",
      },
    });

    expect(Array.isArray(filtered.sessions)).toBe(true);
    expect((filtered.sessions as Array<{ key: string }>).length).toBe(3);
  });

  it("normalizes tier state with model field", () => {
    const state = __testing.normalizeTierState({
      fixed: {
        owner: { tools: ["*"], model: "claude-opus-4" },
      },
      custom: {
        intern: { tools: ["read"], model: "claude-haiku-4-5" },
      },
    });

    expect(state.owner.model).toBe("claude-opus-4");
    expect(state.custom.intern?.model).toBe("claude-haiku-4-5");
  });

  it("extracts patch paths and blocks local urls", () => {
    const paths = __testing.parsePatchPaths(`*** Begin Patch
*** Update File: config/tiers.yaml
@@
-foo
+bar
*** Add File: data/report.md
+hello
*** End Patch`);

    expect(paths).toEqual(["config/tiers.yaml", "data/report.md"]);
    expect(__testing.isBlockedUrl("http://127.0.0.1/internal")).toBe(true);
    expect(__testing.isBlockedUrl("https://docs.openclaw.ai/help")).toBe(false);
  });
});
