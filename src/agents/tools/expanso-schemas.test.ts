import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import {
  ExpansoPipelineSchema,
  ExpansoValidationResultSchema,
  type ExpansoPipeline,
  type ExpansoValidationResult,
} from "./expanso-schemas.js";

// ---------------------------------------------------------------------------
// ExpansoPipelineSchema tests
// ---------------------------------------------------------------------------

describe("ExpansoPipelineSchema", () => {
  it("validates a minimal valid pipeline (no transforms, no metadata)", () => {
    const pipeline: ExpansoPipeline = {
      name: "minimal-pipeline",
      inputs: [{ name: "stdin-in", type: "stdin" }],
      outputs: [{ name: "stdout-out", type: "stdout" }],
    };
    expect(Value.Check(ExpansoPipelineSchema, pipeline)).toBe(true);
  });

  it("validates a full pipeline with transforms, config, and metadata", () => {
    const pipeline: ExpansoPipeline = {
      name: "full-pipeline",
      description: "Reads from Kafka, maps data, writes to S3",
      inputs: [
        {
          name: "kafka-in",
          type: "kafka",
          config: { brokers: "localhost:9092", topics: "events" },
        },
      ],
      transforms: [
        {
          name: "map-step",
          type: "bloblang",
          config: { mapping: "root = this.payload" },
        },
        {
          name: "filter-step",
          type: "filter",
          config: { check: 'this.type == "important"' },
          dependsOn: ["map-step"],
        },
      ],
      outputs: [
        {
          name: "s3-out",
          type: "s3",
          config: { bucket: "my-bucket", region: "us-east-1" },
        },
      ],
      metadata: { version: "1.0", owner: "team-data" },
    };
    expect(Value.Check(ExpansoPipelineSchema, pipeline)).toBe(true);
  });

  it("requires at least one input", () => {
    const pipeline = {
      name: "no-inputs",
      inputs: [], // empty — should fail minItems: 1
      outputs: [{ name: "stdout-out", type: "stdout" }],
    };
    expect(Value.Check(ExpansoPipelineSchema, pipeline)).toBe(false);
  });

  it("requires at least one output", () => {
    const pipeline = {
      name: "no-outputs",
      inputs: [{ name: "stdin-in", type: "stdin" }],
      outputs: [], // empty — should fail minItems: 1
    };
    expect(Value.Check(ExpansoPipelineSchema, pipeline)).toBe(false);
  });

  it("fails when name is missing", () => {
    const pipeline = {
      inputs: [{ name: "stdin-in", type: "stdin" }],
      outputs: [{ name: "stdout-out", type: "stdout" }],
    };
    expect(Value.Check(ExpansoPipelineSchema, pipeline)).toBe(false);
  });

  it("fails when an input entry is missing the type field", () => {
    const pipeline = {
      name: "bad-input",
      inputs: [{ name: "stdin-in" }], // missing type
      outputs: [{ name: "stdout-out", type: "stdout" }],
    };
    expect(Value.Check(ExpansoPipelineSchema, pipeline)).toBe(false);
  });

  it("fails when an output entry is missing the name field", () => {
    const pipeline = {
      name: "bad-output",
      inputs: [{ name: "stdin-in", type: "stdin" }],
      outputs: [{ type: "stdout" }], // missing name
    };
    expect(Value.Check(ExpansoPipelineSchema, pipeline)).toBe(false);
  });

  it("allows optional transforms to be omitted", () => {
    const pipeline: ExpansoPipeline = {
      name: "no-transforms",
      inputs: [{ name: "file-in", type: "file", config: { path: "/tmp/data.json" } }],
      outputs: [{ name: "http-out", type: "http", config: { url: "https://example.com/api" } }],
    };
    expect(Value.Check(ExpansoPipelineSchema, pipeline)).toBe(true);
  });

  it("allows transforms with dependsOn field", () => {
    const pipeline: ExpansoPipeline = {
      name: "dep-pipeline",
      inputs: [{ name: "in", type: "stdin" }],
      transforms: [
        { name: "step-a", type: "bloblang", config: { mapping: "root = this" } },
        { name: "step-b", type: "filter", dependsOn: ["step-a"] },
      ],
      outputs: [{ name: "out", type: "stdout" }],
    };
    expect(Value.Check(ExpansoPipelineSchema, pipeline)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ExpansoValidationResultSchema tests
// ---------------------------------------------------------------------------

describe("ExpansoValidationResultSchema", () => {
  it("validates a successful result with no errors or warnings", () => {
    const result: ExpansoValidationResult = {
      success: true,
      errors: [],
      warnings: [],
    };
    expect(Value.Check(ExpansoValidationResultSchema, result)).toBe(true);
  });

  it("validates a failed result with errors and warnings", () => {
    const result: ExpansoValidationResult = {
      success: false,
      errors: [
        {
          message: "Missing required field 'outputs'",
          location: "pipeline.outputs",
          code: "ERR_MISSING_FIELD",
        },
      ],
      warnings: [
        {
          message: "Deprecated input type 'legacy-file'",
          location: "pipeline.inputs[0].type",
        },
      ],
      rawOutput: "validation failed: 1 error(s)",
      rawError: "",
      exitCode: 1,
    };
    expect(Value.Check(ExpansoValidationResultSchema, result)).toBe(true);
  });

  it("validates a result with rawOutput and exitCode 0", () => {
    const result: ExpansoValidationResult = {
      success: true,
      errors: [],
      warnings: [],
      rawOutput: "Pipeline is valid.",
      exitCode: 0,
    };
    expect(Value.Check(ExpansoValidationResultSchema, result)).toBe(true);
  });

  it("fails when success field is missing", () => {
    const result = {
      errors: [],
      warnings: [],
    };
    expect(Value.Check(ExpansoValidationResultSchema, result)).toBe(false);
  });

  it("fails when errors field is missing", () => {
    const result = {
      success: true,
      warnings: [],
    };
    expect(Value.Check(ExpansoValidationResultSchema, result)).toBe(false);
  });

  it("fails when warnings field is missing", () => {
    const result = {
      success: true,
      errors: [],
    };
    expect(Value.Check(ExpansoValidationResultSchema, result)).toBe(false);
  });

  it("fails when success is not a boolean", () => {
    const result = {
      success: "yes", // wrong type
      errors: [],
      warnings: [],
    };
    expect(Value.Check(ExpansoValidationResultSchema, result)).toBe(false);
  });

  it("fails when a diagnostic entry is missing a message", () => {
    const result = {
      success: false,
      errors: [{ location: "somewhere" }], // missing message
      warnings: [],
    };
    expect(Value.Check(ExpansoValidationResultSchema, result)).toBe(false);
  });

  it("allows optional fields (rawOutput, rawError, exitCode) to be absent", () => {
    const result: ExpansoValidationResult = {
      success: true,
      errors: [],
      warnings: [],
    };
    expect(Value.Check(ExpansoValidationResultSchema, result)).toBe(true);
  });

  it("allows a diagnostic with only a message (location and code optional)", () => {
    const result: ExpansoValidationResult = {
      success: false,
      errors: [{ message: "Something went wrong" }],
      warnings: [{ message: "Potential issue detected" }],
    };
    expect(Value.Check(ExpansoValidationResultSchema, result)).toBe(true);
  });
});
