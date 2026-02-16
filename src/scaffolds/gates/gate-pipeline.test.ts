import { describe, expect, it } from "vitest";
import type { SkillScaffoldInvariantSpecV1 } from "../manifests/skill-scaffold-manifest.v1.js";
import { runGatePipeline } from "./gate-pipeline.js";

describe("runGatePipeline", () => {
  it("returns schema failures deterministically (sorted) and skips extract", () => {
    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["answer"],
      properties: {
        answer: { type: "string", minLength: 3 },
      },
    };

    const invariants: SkillScaffoldInvariantSpecV1[] = [{ id: "no_placeholders" }];

    const res = runGatePipeline({
      artifact: { answer: 1, extra: true },
      schema,
      answerField: "answer",
      invariants,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      // schema failures only
      expect(res.failures[0]?.gate).toBe("schema");
      // extract should not be present when schema fails
      expect(res.failures.some((f) => f.gate === "extract")).toBe(false);
      // deterministic sort: paths increasing
      const paths = res.failures.map((f) => f.path ?? "");
      expect(paths.toSorted()).toEqual(paths);
    }
  });

  it("emits extract failure only if schema passes", () => {
    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["title"],
      properties: {
        title: { type: "string" },
      },
    };

    const res = runGatePipeline({
      artifact: { title: "ok" },
      schema,
      answerField: "answer",
      invariants: [],
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.failures).toHaveLength(1);
      expect(res.failures[0]).toMatchObject({
        gate: "extract",
        id: "answer_field_missing",
        path: "$/answer",
      });
    }
  });

  it("runs invariants in manifest order after schema+extract", () => {
    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["answer"],
      properties: {
        answer: { type: "string" },
      },
    };

    const invariants: SkillScaffoldInvariantSpecV1[] = [
      { id: "no_placeholders" },
      { id: "max_length", params: { field: "answer", max: 3 } },
    ];

    const res = runGatePipeline({
      artifact: { answer: "TODO and long" },
      schema,
      answerField: "answer",
      invariants,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.failures.map((f) => `${f.gate}:${f.id}`)).toEqual([
        "invariant:no_placeholders",
        "invariant:max_length",
      ]);
    }
  });
});
