import { describe, expect, it } from "vitest";
import type { MeridiaEvent } from "../event/normalizer.js";
import { extractHeuristicPhenomenology } from "./heuristic.js";
import { buildPhenomenologyPrompt, extractJsonFromResponse } from "./prompt.js";
import {
  PRIMARY_EMOTIONS,
  ENGAGEMENT_QUALITIES,
  TEXTURE_METAPHORS,
  SENSORY_CHANNELS,
  isValidEmotion,
  isValidEngagement,
  isValidTexture,
  isValidSensoryChannel,
  clampToVocab,
  filterToVocab,
} from "./taxonomy.js";

// ────────────────────────────────────────────────────────────────────────
// Taxonomy tests
// ────────────────────────────────────────────────────────────────────────

describe("phenomenology/taxonomy", () => {
  it("has 17 primary emotions", () => {
    expect(PRIMARY_EMOTIONS).toHaveLength(17);
  });

  it("has 5 engagement qualities", () => {
    expect(ENGAGEMENT_QUALITIES).toHaveLength(5);
  });

  it("has 12 texture metaphors", () => {
    expect(TEXTURE_METAPHORS).toHaveLength(12);
  });

  it("has 5 sensory channels", () => {
    expect(SENSORY_CHANNELS).toHaveLength(5);
  });

  describe("isValidEmotion", () => {
    it("accepts known emotions", () => {
      expect(isValidEmotion("calm")).toBe(true);
      expect(isValidEmotion("frustrated")).toBe(true);
      expect(isValidEmotion("overwhelmed")).toBe(true);
    });

    it("rejects unknown emotions", () => {
      expect(isValidEmotion("happy")).toBe(false);
      expect(isValidEmotion("")).toBe(false);
      expect(isValidEmotion("anger")).toBe(false);
    });
  });

  describe("isValidEngagement", () => {
    it("accepts known values", () => {
      expect(isValidEngagement("deep-flow")).toBe(true);
      expect(isValidEngagement("struggling")).toBe(true);
    });

    it("rejects unknown values", () => {
      expect(isValidEngagement("bored")).toBe(false);
    });
  });

  describe("isValidTexture", () => {
    it("accepts known values", () => {
      expect(isValidTexture("crystalline")).toBe(true);
      expect(isValidTexture("turbulent")).toBe(true);
    });

    it("rejects unknown values", () => {
      expect(isValidTexture("smooth")).toBe(false);
    });
  });

  describe("isValidSensoryChannel", () => {
    it("accepts known values", () => {
      expect(isValidSensoryChannel("verbal")).toBe(true);
      expect(isValidSensoryChannel("somatic")).toBe(true);
    });

    it("rejects unknown values", () => {
      expect(isValidSensoryChannel("tactile")).toBe(false);
    });
  });

  describe("clampToVocab", () => {
    it("returns valid value lowercased", () => {
      expect(clampToVocab("Calm", PRIMARY_EMOTIONS as unknown as readonly string[])).toBe("calm");
    });

    it("returns undefined for invalid value", () => {
      expect(
        clampToVocab("happy", PRIMARY_EMOTIONS as unknown as readonly string[]),
      ).toBeUndefined();
    });

    it("returns undefined for undefined input", () => {
      expect(
        clampToVocab(undefined, PRIMARY_EMOTIONS as unknown as readonly string[]),
      ).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      expect(clampToVocab("", PRIMARY_EMOTIONS as unknown as readonly string[])).toBeUndefined();
    });
  });

  describe("filterToVocab", () => {
    it("filters to only valid values", () => {
      const result = filterToVocab(
        ["calm", "happy", "focused", "angry"],
        PRIMARY_EMOTIONS as unknown as readonly string[],
      );
      expect(result).toEqual(["calm", "focused"]);
    });

    it("returns empty array for empty input", () => {
      expect(filterToVocab([], PRIMARY_EMOTIONS as unknown as readonly string[])).toEqual([]);
    });

    it("returns empty array for undefined input", () => {
      expect(filterToVocab(undefined, PRIMARY_EMOTIONS as unknown as readonly string[])).toEqual(
        [],
      );
    });

    it("handles case insensitivity", () => {
      const result = filterToVocab(
        ["CALM", "Focused"],
        PRIMARY_EMOTIONS as unknown as readonly string[],
      );
      expect(result).toEqual(["calm", "focused"]);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────
// Prompt tests
// ────────────────────────────────────────────────────────────────────────

describe("phenomenology/prompt", () => {
  describe("buildPhenomenologyPrompt", () => {
    it("builds a prompt with all parameters", () => {
      const prompt = buildPhenomenologyPrompt({
        toolName: "bash",
        isError: true,
        score: 0.85,
        reason: "critical failure",
        argsSummary: "rm -rf /tmp/data",
        resultSummary: "Permission denied",
      });

      expect(prompt).toContain("bash");
      expect(prompt).toContain("Error: true");
      expect(prompt).toContain("0.85");
      expect(prompt).toContain("critical failure");
      expect(prompt).toContain("rm -rf /tmp/data");
      expect(prompt).toContain("Permission denied");
      expect(prompt).toContain("emotionalSignature");
      expect(prompt).toContain("engagementQuality");
    });

    it("builds a prompt without optional parameters", () => {
      const prompt = buildPhenomenologyPrompt({
        toolName: "read",
        isError: false,
        score: 0.5,
      });

      expect(prompt).toContain("read");
      expect(prompt).toContain("Error: false");
      expect(prompt).not.toContain("Args:");
      expect(prompt).not.toContain("Result:");
    });

    it("includes JSON schema in output", () => {
      const prompt = buildPhenomenologyPrompt({
        toolName: "test",
        isError: false,
        score: 0.5,
      });
      expect(prompt).toContain("JSON schema:");
      expect(prompt).toContain("Constraints:");
    });
  });

  describe("extractJsonFromResponse", () => {
    it("extracts JSON from clean response", () => {
      const response = '{"emotionalSignature":{"primary":["calm"],"intensity":0.5}}';
      const result = extractJsonFromResponse(response);
      expect(result).not.toBeNull();
      expect(result!.emotionalSignature).toBeDefined();
    });

    it("extracts JSON surrounded by text", () => {
      const response = 'Here is the result:\n{"key": "value"}\nDone.';
      const result = extractJsonFromResponse(response);
      expect(result).toEqual({ key: "value" });
    });

    it("handles nested JSON objects", () => {
      const response = '{"outer":{"inner":{"deep":"value"}}}';
      const result = extractJsonFromResponse(response);
      expect(result).toEqual({ outer: { inner: { deep: "value" } } });
    });

    it("returns null for no JSON", () => {
      expect(extractJsonFromResponse("No JSON here")).toBeNull();
    });

    it("returns null for invalid JSON", () => {
      expect(extractJsonFromResponse("{invalid json}")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(extractJsonFromResponse("")).toBeNull();
    });

    it("returns null when } comes before {", () => {
      expect(extractJsonFromResponse("} then {")).toBeNull();
    });
  });
});

// ────────────────────────────────────────────────────────────────────────
// Heuristic tests
// ────────────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<MeridiaEvent> = {}): MeridiaEvent {
  return {
    id: "test-id",
    kind: "tool_result",
    ts: new Date().toISOString(),
    session: { key: "s1" },
    tool: { name: "bash", callId: "tc-1", isError: false },
    payload: {},
    provenance: { source: "hook" },
    ...overrides,
  };
}

describe("phenomenology/heuristic", () => {
  describe("extractHeuristicPhenomenology", () => {
    it("returns focused for generic tool", () => {
      const result = extractHeuristicPhenomenology(makeEvent(), 0.5);
      expect(result.emotionalSignature.primary).toContain("focused");
      expect(result.engagementQuality).toBe("routine");
    });

    it("returns error emotions for error events", () => {
      const event = makeEvent({ tool: { name: "bash", callId: "tc-1", isError: true } });
      const result = extractHeuristicPhenomenology(event, 0.5);
      expect(result.emotionalSignature.primary).toContain("concerned");
      expect(result.emotionalSignature.primary).toContain("frustrated");
      expect(result.emotionalSignature.valence).toBeLessThan(0);
      expect(result.engagementQuality).toBe("struggling");
    });

    it("returns write emotions for write tool", () => {
      const event = makeEvent({ tool: { name: "write", callId: "tc-1", isError: false } });
      const result = extractHeuristicPhenomenology(event, 0.7);
      expect(result.emotionalSignature.primary).toContain("focused");
      expect(result.emotionalSignature.primary).toContain("engaged");
    });

    it("returns read emotions for read tool", () => {
      const event = makeEvent({ tool: { name: "read", callId: "tc-1", isError: false } });
      const result = extractHeuristicPhenomenology(event, 0.5);
      expect(result.emotionalSignature.primary).toContain("curious");
      expect(result.emotionalSignature.primary).toContain("calm");
    });

    it("returns message emotions for message tool", () => {
      const event = makeEvent({ tool: { name: "message", callId: "tc-1", isError: false } });
      const result = extractHeuristicPhenomenology(event, 0.5);
      expect(result.emotionalSignature.primary).toContain("engaged");
      expect(result.emotionalSignature.primary).toContain("hopeful");
    });

    it("returns exec emotions for bash/exec", () => {
      const event = makeEvent({ tool: { name: "exec", callId: "tc-1", isError: false } });
      const result = extractHeuristicPhenomenology(event, 0.5);
      expect(result.emotionalSignature.primary).toContain("focused");
      expect(result.emotionalSignature.primary).toContain("cautious");
    });

    it("returns deep-flow for high significance", () => {
      const result = extractHeuristicPhenomenology(makeEvent(), 0.9);
      expect(result.engagementQuality).toBe("deep-flow");
    });

    it("returns engaged for medium significance", () => {
      const result = extractHeuristicPhenomenology(makeEvent(), 0.7);
      expect(result.engagementQuality).toBe("engaged");
    });

    it("returns routine for low significance", () => {
      const result = extractHeuristicPhenomenology(makeEvent(), 0.4);
      expect(result.engagementQuality).toBe("routine");
    });

    it("clamps intensity to 0.2-1.0 range", () => {
      const low = extractHeuristicPhenomenology(makeEvent(), 0.1);
      expect(low.emotionalSignature.intensity).toBe(0.2);

      const high = extractHeuristicPhenomenology(makeEvent(), 1.5);
      expect(high.emotionalSignature.intensity).toBe(1);
    });

    it("sets positive valence for high significance", () => {
      const result = extractHeuristicPhenomenology(makeEvent(), 0.8);
      expect(result.emotionalSignature.valence).toBeGreaterThan(0);
    });

    it("handles missing tool info", () => {
      const event = makeEvent({ tool: undefined });
      const result = extractHeuristicPhenomenology(event, 0.5);
      expect(result.emotionalSignature.primary).toContain("focused");
      expect(result.engagementQuality).toBe("routine");
    });

    it("does not include anchors or uncertainties", () => {
      const result = extractHeuristicPhenomenology(makeEvent(), 0.8);
      expect(result.anchors).toBeUndefined();
      expect(result.uncertainties).toBeUndefined();
      expect(result.reconstitutionHints).toBeUndefined();
    });
  });
});
