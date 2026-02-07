import { describe, expect, it } from "vitest";
import type { MeridiaEvent } from "../event/normalizer.js";
import type { CaptureDecision, Phenomenology } from "../types.js";
import { buildExperienceKit, kitToLegacyRecord } from "./builder.js";
import { isMeridiaUri, extractIdFromUri, buildMeridiaUri, renderKit } from "./resolver.js";

// ────────────────────────────────────────────────────────────────────────
// Test helpers
// ────────────────────────────────────────────────────────────────────────

function makeEvent(): MeridiaEvent {
  return {
    id: "evt-123",
    kind: "tool_result",
    ts: "2025-03-01T10:00:00.000Z",
    session: { key: "session-1", id: "sid-1", runId: "run-1" },
    tool: { name: "bash", callId: "tc-1", isError: false, meta: "exec" },
    payload: { args: { cmd: "ls" }, result: { output: "file.txt" } },
    provenance: { source: "hook" },
  };
}

function makeDecision(): CaptureDecision {
  return {
    shouldCapture: true,
    significance: 0.85,
    threshold: 0.6,
    mode: "full",
    reason: "Important tool invocation",
  };
}

function makePhenomenology(): Phenomenology {
  return {
    emotionalSignature: {
      primary: ["focused", "engaged"],
      intensity: 0.7,
      valence: 0.4,
      texture: "flowing",
    },
    engagementQuality: "deep-flow",
    anchors: [
      {
        phrase: "ls command output",
        significance: "File listing context",
        sensoryChannel: "verbal",
      },
    ],
    uncertainties: ["What is the purpose of the listed files?"],
    reconstitutionHints: ["Review the directory structure for navigation context"],
  };
}

// ────────────────────────────────────────────────────────────────────────
// Builder tests
// ────────────────────────────────────────────────────────────────────────

describe("kit/builder", () => {
  describe("buildExperienceKit", () => {
    it("builds a kit with all fields", () => {
      const kit = buildExperienceKit({
        event: makeEvent(),
        decision: makeDecision(),
        phenomenology: makePhenomenology(),
        summary: "Listed files in directory",
      });

      expect(kit.version).toBe(2);
      expect(kit.id).toBe("evt-123");
      expect(kit.ts).toBe("2025-03-01T10:00:00.000Z");
      expect(kit.kind).toBe("tool_result");
      expect(kit.session?.key).toBe("session-1");
      expect(kit.tool?.name).toBe("bash");
      expect(kit.capture.significance).toBe(0.85);
      expect(kit.capture.threshold).toBe(0.6);
      expect(kit.phenomenology?.engagementQuality).toBe("deep-flow");
      expect(kit.content?.summary).toBe("Listed files in directory");
    });

    it("builds a kit without optional phenomenology", () => {
      const kit = buildExperienceKit({
        event: makeEvent(),
        decision: makeDecision(),
        summary: "test",
      });

      expect(kit.phenomenology).toBeUndefined();
      expect(kit.version).toBe(2);
    });

    it("includes artifacts when provided", () => {
      const artifacts = [{ id: "a1", kind: "file" as const, uri: "/path/to/file.ts" }];
      const kit = buildExperienceKit({
        event: makeEvent(),
        decision: makeDecision(),
        artifacts,
      });

      expect(kit.artifacts).toHaveLength(1);
      expect(kit.artifacts![0]!.uri).toBe("/path/to/file.ts");
    });

    it("omits artifacts when empty array", () => {
      const kit = buildExperienceKit({
        event: makeEvent(),
        decision: makeDecision(),
        artifacts: [],
      });
      expect(kit.artifacts).toBeUndefined();
    });

    it("maps manual_capture kind", () => {
      const event = { ...makeEvent(), kind: "manual_capture" as const };
      const kit = buildExperienceKit({ event, decision: makeDecision() });
      expect(kit.kind).toBe("manual");
    });

    it("maps session_boundary kind", () => {
      const event = { ...makeEvent(), kind: "session_boundary" as const };
      const kit = buildExperienceKit({ event, decision: makeDecision() });
      expect(kit.kind).toBe("session_end");
    });

    it("defaults unknown kind to tool_result", () => {
      const event = { ...makeEvent(), kind: "bootstrap" as const };
      const kit = buildExperienceKit({ event, decision: makeDecision() });
      expect(kit.kind).toBe("tool_result");
    });

    it("handles event without tool", () => {
      const event = { ...makeEvent(), tool: undefined };
      const kit = buildExperienceKit({ event, decision: makeDecision() });
      expect(kit.tool).toBeUndefined();
    });

    it("includes tags and context", () => {
      const kit = buildExperienceKit({
        event: makeEvent(),
        decision: makeDecision(),
        tags: ["debug", "test"],
        context: "Investigating a bug",
      });
      expect(kit.content?.tags).toEqual(["debug", "test"]);
      expect(kit.content?.context).toBe("Investigating a bug");
    });

    it("uses decision reason as topic when no topic provided", () => {
      const kit = buildExperienceKit({
        event: makeEvent(),
        decision: makeDecision(),
      });
      expect(kit.content?.topic).toBe("Important tool invocation");
    });

    it("includes raw payload data", () => {
      const kit = buildExperienceKit({
        event: makeEvent(),
        decision: makeDecision(),
      });
      expect(kit.raw).toBeDefined();
      expect(kit.raw?.toolArgs).toEqual({ cmd: "ls" });
      expect(kit.raw?.toolResult).toEqual({ output: "file.txt" });
    });
  });

  describe("kitToLegacyRecord", () => {
    it("converts kit to legacy MeridiaExperienceRecord", () => {
      const kit = buildExperienceKit({
        event: makeEvent(),
        decision: makeDecision(),
        phenomenology: makePhenomenology(),
        summary: "test summary",
      });

      const record = kitToLegacyRecord(kit);

      expect(record.id).toBe("evt-123");
      expect(record.ts).toBe("2025-03-01T10:00:00.000Z");
      expect(record.kind).toBe("tool_result");
      expect(record.session?.key).toBe("session-1");
      expect(record.tool?.name).toBe("bash");
      expect(record.capture.score).toBe(0.85);
      expect(record.capture.threshold).toBe(0.6);
      expect(record.capture.evaluation.kind).toBe("heuristic");
      expect(record.capture.evaluation.reason).toBe("Important tool invocation");
      expect(record.content?.summary).toBe("test summary");
      // V2: phenomenology preserved
      expect(record.phenomenology).toBeDefined();
      expect(record.phenomenology?.engagementQuality).toBe("deep-flow");
      expect(record.phenomenology?.emotionalSignature?.primary).toContain("focused");
    });

    it("handles kit without phenomenology", () => {
      const kit = buildExperienceKit({
        event: makeEvent(),
        decision: makeDecision(),
      });

      const record = kitToLegacyRecord(kit);
      expect(record.phenomenology).toBeUndefined();
    });
  });
});

// ────────────────────────────────────────────────────────────────────────
// Resolver tests
// ────────────────────────────────────────────────────────────────────────

describe("kit/resolver", () => {
  describe("isMeridiaUri", () => {
    it("recognizes meridia:// URIs", () => {
      expect(isMeridiaUri("meridia://abc-123")).toBe(true);
      expect(isMeridiaUri("meridia://")).toBe(true);
    });

    it("rejects non-meridia URIs", () => {
      expect(isMeridiaUri("https://example.com")).toBe(false);
      expect(isMeridiaUri("file:///path")).toBe(false);
      expect(isMeridiaUri("meridia-something")).toBe(false);
      expect(isMeridiaUri("")).toBe(false);
    });
  });

  describe("extractIdFromUri", () => {
    it("extracts ID from URI", () => {
      expect(extractIdFromUri("meridia://abc-123-def")).toBe("abc-123-def");
    });

    it("returns null for non-meridia URI", () => {
      expect(extractIdFromUri("https://example.com")).toBeNull();
    });

    it("returns null for empty path", () => {
      expect(extractIdFromUri("meridia://")).toBeNull();
    });
  });

  describe("buildMeridiaUri", () => {
    it("builds a valid meridia URI", () => {
      expect(buildMeridiaUri("rec-123")).toBe("meridia://rec-123");
    });
  });

  describe("renderKit", () => {
    it("renders a record as markdown", () => {
      const record = kitToLegacyRecord(
        buildExperienceKit({
          event: makeEvent(),
          decision: makeDecision(),
          phenomenology: makePhenomenology(),
          summary: "Files were listed",
        }),
      );

      const text = renderKit(record);
      expect(text).toContain("bash");
      expect(text).toContain("0.85");
      expect(text).toContain("Files were listed");
      expect(text).toContain("focused");
      expect(text).toContain("deep-flow");
    });

    it("renders a record without phenomenology", () => {
      const record = kitToLegacyRecord(
        buildExperienceKit({
          event: makeEvent(),
          decision: makeDecision(),
          summary: "Simple test",
        }),
      );

      const text = renderKit(record);
      expect(text).toContain("bash");
      expect(text).toContain("Simple test");
    });

    it("renders error indicator", () => {
      const event = {
        ...makeEvent(),
        tool: { name: "bash", callId: "tc-1", isError: true },
      };
      const record = kitToLegacyRecord(
        buildExperienceKit({
          event,
          decision: makeDecision(),
          summary: "Error happened",
        }),
      );

      const text = renderKit(record);
      expect(text).toContain("Error");
    });

    it("renders tags when present", () => {
      const record = kitToLegacyRecord(
        buildExperienceKit({
          event: makeEvent(),
          decision: makeDecision(),
          tags: ["debug", "testing"],
        }),
      );

      const text = renderKit(record);
      expect(text).toContain("debug");
      expect(text).toContain("testing");
    });

    it("renders topic section", () => {
      const record = kitToLegacyRecord(
        buildExperienceKit({
          event: makeEvent(),
          decision: makeDecision(),
          topic: "Custom topic",
        }),
      );

      const text = renderKit(record);
      expect(text).toContain("Custom topic");
    });

    it("renders phenomenology anchors and uncertainties", () => {
      const record = kitToLegacyRecord(
        buildExperienceKit({
          event: makeEvent(),
          decision: makeDecision(),
          phenomenology: makePhenomenology(),
        }),
      );

      const text = renderKit(record);
      expect(text).toContain("Anchors");
      expect(text).toContain("ls command output");
      expect(text).toContain("Uncertainties");
      expect(text).toContain("Reconstitution Hints");
    });

    it("renders valence and texture", () => {
      const record = kitToLegacyRecord(
        buildExperienceKit({
          event: makeEvent(),
          decision: makeDecision(),
          phenomenology: makePhenomenology(),
        }),
      );

      const text = renderKit(record);
      expect(text).toContain("Valence");
      expect(text).toContain("Texture");
      expect(text).toContain("flowing");
    });
  });

  describe("resolveKitUri", () => {
    it("returns null for non-meridia URI", async () => {
      const { resolveKitUri } = await import("./resolver.js");
      const mockBackend = {} as any;
      const result = await resolveKitUri("https://example.com", mockBackend);
      expect(result).toBeNull();
    });

    it("returns null for empty path URI", async () => {
      const { resolveKitUri } = await import("./resolver.js");
      const mockBackend = {} as any;
      const result = await resolveKitUri("meridia://", mockBackend);
      expect(result).toBeNull();
    });

    it("returns null when record not found", async () => {
      const { resolveKitUri } = await import("./resolver.js");
      const mockBackend = { getRecordById: async () => null } as any;
      const result = await resolveKitUri("meridia://nonexistent", mockBackend);
      expect(result).toBeNull();
    });

    it("resolves and renders a record", async () => {
      const { resolveKitUri } = await import("./resolver.js");
      const record = kitToLegacyRecord(
        buildExperienceKit({
          event: makeEvent(),
          decision: makeDecision(),
          summary: "Found record",
        }),
      );
      const mockBackend = {
        getRecordById: async () => ({ record }),
      } as any;

      const result = await resolveKitUri("meridia://evt-123", mockBackend);
      expect(result).not.toBeNull();
      expect(result!.text).toContain("Found record");
      expect(result!.path).toBe("meridia://evt-123");
    });
  });
});
