import { describe, expect, it } from "vitest";
import type { ScoredResult } from "../retrieve/ranker.js";
import type { MeridiaExperienceRecord, Phenomenology } from "../types.js";
import { buildStructuredPack, renderPackAsMarkdown } from "./pack-builder.js";

// ────────────────────────────────────────────────────────────────────────
// Test helpers
// ────────────────────────────────────────────────────────────────────────

function makeRecord(
  id: string,
  score: number,
  opts: {
    toolName?: string;
    isError?: boolean;
    topic?: string;
    phenom?: Phenomenology;
    hoursAgo?: number;
    sessionKey?: string;
  } = {},
): MeridiaExperienceRecord {
  const hoursAgo = opts.hoursAgo ?? 1;
  const ts = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
  return {
    id,
    ts,
    kind: "tool_result",
    session: { key: opts.sessionKey ?? "s1" },
    tool: { name: opts.toolName ?? "bash", callId: `tc-${id}`, isError: opts.isError ?? false },
    capture: {
      score,
      evaluation: { kind: "heuristic", score, reason: `reason for ${id}` },
    },
    content: { topic: opts.topic ?? `Topic for ${id}` },
    data: {},
    phenomenology: opts.phenom,
  };
}

function makeScoredResult(
  id: string,
  score: number,
  opts: Parameters<typeof makeRecord>[2] = {},
): ScoredResult {
  return {
    record: makeRecord(id, score, opts),
    source: "canonical",
    sourceScore: -5,
    finalScore: score,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Pack builder tests
// ────────────────────────────────────────────────────────────────────────

describe("reconstitution/pack-builder", () => {
  describe("buildStructuredPack", () => {
    it("builds a pack from scored results", () => {
      const results: ScoredResult[] = [
        makeScoredResult("r1", 0.9, { topic: "Important discovery" }),
        makeScoredResult("r2", 0.7, { topic: "Supporting evidence" }),
      ];

      const pack = buildStructuredPack(results, { canonical: 2, graph: 0, vector: 0 });

      expect(pack.summary).toBeTruthy();
      expect(pack.summary).toContain("Important discovery");
      expect(pack.citations).toHaveLength(2);
      expect(pack.citations[0]!.uri).toBe("meridia://r1");
      expect(pack.meta?.recordCount).toBe(2);
      expect(pack.meta?.sessionCount).toBe(1);
      expect(pack.meta?.sources).toEqual({ canonical: 2, graph: 0, vector: 0 });
    });

    it("handles empty results", () => {
      const pack = buildStructuredPack([], { canonical: 0, graph: 0, vector: 0 });

      expect(pack.summary).toBe("");
      expect(pack.citations).toHaveLength(0);
      expect(pack.meta?.recordCount).toBe(0);
    });

    it("collects anchors from phenomenology", () => {
      const phenom: Phenomenology = {
        emotionalSignature: { primary: ["focused"], intensity: 0.8, valence: 0.5 },
        engagementQuality: "deep-flow",
        anchors: [
          {
            phrase: "breakthrough moment",
            significance: "key insight",
            sensoryChannel: "conceptual",
          },
        ],
        uncertainties: ["What about edge cases?"],
        reconstitutionHints: ["Start with the breakthrough context"],
      };

      const results: ScoredResult[] = [makeScoredResult("r1", 0.9, { phenom })];

      const pack = buildStructuredPack(results, { canonical: 1, graph: 0, vector: 0 });

      expect(pack.anchors.length).toBeGreaterThan(0);
      expect(pack.anchors[0]!.phrase).toBe("breakthrough moment");
      expect(pack.openUncertainties).toContain("What about edge cases?");
      expect(pack.approachGuidance).toContain("Start with the breakthrough context");
    });

    it("builds approach guidance from error patterns", () => {
      const results: ScoredResult[] = [
        makeScoredResult("r1", 0.8, { isError: true, toolName: "bash" }),
        makeScoredResult("r2", 0.7),
      ];

      const pack = buildStructuredPack(results, { canonical: 2, graph: 0, vector: 0 });

      const errorGuidance = pack.approachGuidance.find((g) => g.includes("cautious"));
      expect(errorGuidance).toBeTruthy();
    });

    it("builds approach guidance from struggling engagement", () => {
      const phenom: Phenomenology = {
        emotionalSignature: { primary: ["frustrated"], intensity: 0.8, valence: -0.3 },
        engagementQuality: "struggling",
      };

      const results: ScoredResult[] = [
        makeScoredResult("r1", 0.8, { phenom }),
        makeScoredResult("r2", 0.7, { phenom }),
        makeScoredResult("r3", 0.6, { phenom }),
        makeScoredResult("r4", 0.5),
      ];

      const pack = buildStructuredPack(results, { canonical: 4, graph: 0, vector: 0 });

      const freshApproach = pack.approachGuidance.find((g) => g.includes("fresh approach"));
      expect(freshApproach).toBeTruthy();
    });

    it("handles multiple sessions", () => {
      const results: ScoredResult[] = [
        makeScoredResult("r1", 0.8, { sessionKey: "s1" }),
        makeScoredResult("r2", 0.7, { sessionKey: "s2" }),
        makeScoredResult("r3", 0.6, { sessionKey: "s3" }),
      ];

      const pack = buildStructuredPack(results, { canonical: 3, graph: 0, vector: 0 });
      expect(pack.meta?.sessionCount).toBe(3);
    });

    it("deduplicates uncertainties", () => {
      const phenom: Phenomenology = {
        emotionalSignature: { primary: ["curious"], intensity: 0.5, valence: 0.2 },
        engagementQuality: "engaged",
        uncertainties: ["Same question"],
      };

      const results: ScoredResult[] = [
        makeScoredResult("r1", 0.8, { phenom }),
        makeScoredResult("r2", 0.7, { phenom }),
      ];

      const pack = buildStructuredPack(results, { canonical: 2, graph: 0, vector: 0 });
      const sameQ = pack.openUncertainties.filter((u) => u === "Same question");
      expect(sameQ).toHaveLength(1);
    });

    it("limits citations to 10", () => {
      const results: ScoredResult[] = Array.from({ length: 15 }, (_, i) =>
        makeScoredResult(`r${i}`, 0.9 - i * 0.01),
      );

      const pack = buildStructuredPack(results, { canonical: 15, graph: 0, vector: 0 });
      expect(pack.citations.length).toBeLessThanOrEqual(10);
    });
  });

  describe("renderPackAsMarkdown", () => {
    it("renders all sections", () => {
      const md = renderPackAsMarkdown({
        summary: "This is what happened.",
        approachGuidance: ["Be careful with bash"],
        anchors: [{ phrase: "key moment", instruction: "important", citation: "meridia://r1" }],
        openUncertainties: ["What about tests?"],
        nextActions: ["Review the implementation"],
        citations: [{ id: "r1", kind: "tool_result", uri: "meridia://r1" }],
      });

      expect(md).toContain("## Experiential Continuity");
      expect(md).toContain("This is what happened.");
      expect(md).toContain("### Approach Guidance");
      expect(md).toContain("Be careful with bash");
      expect(md).toContain("### Reconstitution Anchors");
      expect(md).toContain("key moment");
      expect(md).toContain("### Open Uncertainties");
      expect(md).toContain("What about tests?");
      expect(md).toContain("### Next Actions");
      expect(md).toContain("Review the implementation");
    });

    it("omits empty sections", () => {
      const md = renderPackAsMarkdown({
        summary: "Brief summary.",
        approachGuidance: [],
        anchors: [],
        openUncertainties: [],
        nextActions: [],
        citations: [],
      });

      expect(md).toContain("Brief summary.");
      expect(md).not.toContain("### Approach Guidance");
      expect(md).not.toContain("### Reconstitution Anchors");
      expect(md).not.toContain("### Open Uncertainties");
      expect(md).not.toContain("### Next Actions");
    });

    it("renders correctly with only summary", () => {
      const md = renderPackAsMarkdown({
        summary: "Just a summary.",
        approachGuidance: [],
        anchors: [],
        openUncertainties: [],
        nextActions: [],
        citations: [],
      });

      expect(md).toContain("Just a summary.");
      expect(md.trim().split("\n").length).toBeGreaterThan(1);
    });
  });
});
