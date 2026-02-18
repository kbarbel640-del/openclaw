/**
 * TypeBox schemas for Expanso pipeline configurations and validation results.
 *
 * These schemas provide consistent data structures for:
 *  - NL-to-YAML pipeline generation (ExpansoPipelineSchema)
 *  - Binary validation output parsing (ExpansoValidationResultSchema)
 */
import { type Static, Type } from "@sinclair/typebox";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** A key-value map of arbitrary string metadata / configuration. */
const StringRecordSchema = Type.Record(Type.String(), Type.Unknown());

// ---------------------------------------------------------------------------
// Pipeline component schemas
// ---------------------------------------------------------------------------

/**
 * Represents a single Expanso pipeline input source.
 * Inputs define where data enters the pipeline (files, network, etc.).
 */
export const ExpansoInputSchema = Type.Object(
  {
    /** Unique name for this input within the pipeline. */
    name: Type.String({ description: "Unique name for this input source" }),
    /** Input driver / plugin type (e.g. "file", "kafka", "http"). */
    type: Type.String({ description: "Input driver type" }),
    /**
     * Driver-specific configuration options.
     * The shape depends on the chosen type.
     */
    config: Type.Optional(StringRecordSchema),
  },
  { description: "An Expanso pipeline input source" },
);

/**
 * Represents a single Expanso pipeline transform step.
 * Transforms process, filter, or enrich data flowing through the pipeline.
 */
export const ExpansoTransformSchema = Type.Object(
  {
    /** Unique name for this transform within the pipeline. */
    name: Type.String({ description: "Unique name for this transform step" }),
    /** Transform processor type (e.g. "mapping", "filter", "bloblang"). */
    type: Type.String({ description: "Transform processor type" }),
    /**
     * Processor-specific configuration options.
     * The shape depends on the chosen type.
     */
    config: Type.Optional(StringRecordSchema),
    /** Ordered list of transform names that must run before this one. */
    dependsOn: Type.Optional(
      Type.Array(Type.String(), {
        description: "Names of transforms this step depends on",
      }),
    ),
  },
  { description: "An Expanso pipeline transform/processing step" },
);

/**
 * Represents a single Expanso pipeline output destination.
 * Outputs define where processed data is sent (files, queues, APIs, etc.).
 */
export const ExpansoOutputSchema = Type.Object(
  {
    /** Unique name for this output within the pipeline. */
    name: Type.String({ description: "Unique name for this output destination" }),
    /** Output driver / plugin type (e.g. "file", "kafka", "http", "stdout"). */
    type: Type.String({ description: "Output driver type" }),
    /**
     * Driver-specific configuration options.
     * The shape depends on the chosen type.
     */
    config: Type.Optional(StringRecordSchema),
  },
  { description: "An Expanso pipeline output destination" },
);

// ---------------------------------------------------------------------------
// Top-level pipeline schema
// ---------------------------------------------------------------------------

/**
 * Schema for a complete Expanso pipeline configuration.
 *
 * Covers the core components required to describe a pipeline for NL-to-YAML
 * generation: inputs, optional transforms, and outputs.
 */
export const ExpansoPipelineSchema = Type.Object(
  {
    /** Human-readable name for this pipeline. */
    name: Type.String({ description: "Human-readable name for the pipeline" }),
    /** Optional description of what the pipeline does. */
    description: Type.Optional(
      Type.String({ description: "Human-readable description of the pipeline" }),
    ),
    /**
     * One or more input sources.
     * At least one input is required for a valid pipeline.
     */
    inputs: Type.Array(ExpansoInputSchema, {
      minItems: 1,
      description: "Pipeline input sources (at least one required)",
    }),
    /**
     * Zero or more transform/processing steps.
     * Transforms are applied in the order defined (unless dependsOn overrides).
     */
    transforms: Type.Optional(
      Type.Array(ExpansoTransformSchema, {
        description: "Pipeline processing/transform steps",
      }),
    ),
    /**
     * One or more output destinations.
     * At least one output is required for a valid pipeline.
     */
    outputs: Type.Array(ExpansoOutputSchema, {
      minItems: 1,
      description: "Pipeline output destinations (at least one required)",
    }),
    /** Optional top-level pipeline metadata. */
    metadata: Type.Optional(StringRecordSchema),
  },
  {
    title: "ExpansoPipeline",
    description: "Complete Expanso pipeline configuration covering inputs, transforms, and outputs",
  },
);

// ---------------------------------------------------------------------------
// Validation result schema
// ---------------------------------------------------------------------------

/**
 * Represents a single validation diagnostic (error or warning).
 */
export const ExpansoValidationDiagnosticSchema = Type.Object(
  {
    /** Human-readable message describing the diagnostic. */
    message: Type.String({ description: "Diagnostic message" }),
    /**
     * Optional location within the YAML where the issue was found.
     * May be a line number, key path, or component name.
     */
    location: Type.Optional(Type.String({ description: "Location of the issue in the YAML" })),
    /** Optional error/warning code produced by the validator binary. */
    code: Type.Optional(Type.String({ description: "Validator error/warning code" })),
  },
  { description: "A single validation diagnostic (error or warning)" },
);

/**
 * Schema for the structured result returned after running the Expanso
 * validation binary against a pipeline YAML.
 *
 * Fields cover the binary's exit/success status, any errors, and any warnings.
 */
export const ExpansoValidationResultSchema = Type.Object(
  {
    /** Whether the validation binary reported success (exit code 0, no errors). */
    success: Type.Boolean({
      description: "True if the pipeline passed validation without errors",
    }),
    /**
     * Errors that caused validation to fail.
     * An empty array means no errors were reported.
     */
    errors: Type.Array(ExpansoValidationDiagnosticSchema, {
      description: "Validation errors that caused the pipeline to fail",
    }),
    /**
     * Warnings that did not cause outright failure but should be addressed.
     * An empty array means no warnings were reported.
     */
    warnings: Type.Array(ExpansoValidationDiagnosticSchema, {
      description: "Validation warnings (non-fatal issues)",
    }),
    /**
     * Raw standard-output captured from the validation binary.
     * Useful for debugging when structured parsing is incomplete.
     */
    rawOutput: Type.Optional(
      Type.String({ description: "Raw stdout from the expanso validate binary" }),
    ),
    /**
     * Raw standard-error captured from the validation binary.
     */
    rawError: Type.Optional(
      Type.String({ description: "Raw stderr from the expanso validate binary" }),
    ),
    /**
     * The binary's numeric exit code.
     * Typically 0 for success, non-zero for failure.
     */
    exitCode: Type.Optional(
      Type.Number({ description: "Exit code returned by the expanso validate binary" }),
    ),
  },
  {
    title: "ExpansoValidationResult",
    description:
      "Structured result from running the expanso validate binary against a pipeline YAML",
  },
);

// ---------------------------------------------------------------------------
// Derived TypeScript types
// ---------------------------------------------------------------------------

/** TypeScript type derived from {@link ExpansoInputSchema}. */
export type ExpansoInput = Static<typeof ExpansoInputSchema>;

/** TypeScript type derived from {@link ExpansoTransformSchema}. */
export type ExpansoTransform = Static<typeof ExpansoTransformSchema>;

/** TypeScript type derived from {@link ExpansoOutputSchema}. */
export type ExpansoOutput = Static<typeof ExpansoOutputSchema>;

/** TypeScript type derived from {@link ExpansoPipelineSchema}. */
export type ExpansoPipeline = Static<typeof ExpansoPipelineSchema>;

/** TypeScript type derived from {@link ExpansoValidationDiagnosticSchema}. */
export type ExpansoValidationDiagnostic = Static<typeof ExpansoValidationDiagnosticSchema>;

/** TypeScript type derived from {@link ExpansoValidationResultSchema}. */
export type ExpansoValidationResult = Static<typeof ExpansoValidationResultSchema>;
