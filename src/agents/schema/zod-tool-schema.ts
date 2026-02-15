import { z } from "zod";

/**
 * Convert a Zod schema to JSON Schema that LLM function-calling providers accept.
 *
 * Zod 4's `z.toJSONSchema()` output is close to usable, but a few patterns
 * break Anthropic, OpenAI, and Gemini tool validators:
 *
 * - `.nullable()` → `anyOf: [{type:X}, {type:"null"}]` — rejected by most providers
 * - `additionalProperties`, `propertyNames`, `$schema` — rejected by Gemini
 * - `.int()` adds `minimum/maximum: ±MAX_SAFE_INTEGER` — noisy, stripped by Gemini
 *
 * This function post-processes the output so it works across all providers.
 * The result can optionally be further cleaned by `cleanSchemaForGemini`.
 */
export function zodToToolJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, { target: "draft-2020-12" });
  return flattenForLlm(raw) as Record<string, unknown>;
}

// Sentinel bounds Zod emits for `.int()` checks.
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const MIN_SAFE = -Number.MAX_SAFE_INTEGER;

// Top-level metadata keys LLMs don't need.
const STRIP_ROOT_KEYS = new Set(["$schema", "$id"]);

// Keys we strip from every sub-schema for broad provider compat.
const STRIP_PROPERTY_KEYS = new Set(["additionalProperties", "propertyNames"]);

function flattenForLlm(node: unknown): unknown {
  if (node === null || node === undefined) {
    return node;
  }
  if (Array.isArray(node)) {
    return node.map(flattenForLlm);
  }
  if (typeof node !== "object") {
    return node;
  }

  const obj = node as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  // Try to flatten anyOf/oneOf nullable patterns first.
  const anyOfFlattened = tryFlattenNullable(obj, "anyOf");
  if (anyOfFlattened) {
    return anyOfFlattened;
  }
  const oneOfFlattened = tryFlattenNullable(obj, "oneOf");
  if (oneOfFlattened) {
    return oneOfFlattened;
  }

  for (const [key, value] of Object.entries(obj)) {
    // Strip metadata and provider-hostile keys.
    if (STRIP_ROOT_KEYS.has(key) || STRIP_PROPERTY_KEYS.has(key)) {
      continue;
    }

    if (key === "properties" && value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, flattenForLlm(v)]),
      );
    } else if (key === "items") {
      result[key] = flattenForLlm(value);
    } else if (key === "anyOf" || key === "oneOf" || key === "allOf") {
      if (Array.isArray(value)) {
        result[key] = value.map(flattenForLlm);
      } else {
        result[key] = value;
      }
    } else if (key === "minimum" && value === MIN_SAFE) {
      // Strip Zod's automatic int() bounds — they're just noise.
      continue;
    } else if (key === "maximum" && value === MAX_SAFE) {
      continue;
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Flatten `anyOf: [{...schema}, {type:"null"}]` → just the non-null schema.
 * LLMs don't understand nullable patterns; they just want the core type.
 * Also handles the case where the non-null part is a literal enum.
 */
function tryFlattenNullable(
  obj: Record<string, unknown>,
  variantKey: "anyOf" | "oneOf",
): Record<string, unknown> | null {
  const variants = obj[variantKey];
  if (!Array.isArray(variants) || variants.length !== 2) {
    return null;
  }

  const [a, b] = variants;
  const nullIndex = isNullSchema(a) ? 0 : isNullSchema(b) ? 1 : -1;
  if (nullIndex === -1) {
    return null;
  }

  const nonNull = nullIndex === 0 ? b : a;
  if (!nonNull || typeof nonNull !== "object" || Array.isArray(nonNull)) {
    return null;
  }

  // Recursively clean the non-null variant.
  const cleaned = flattenForLlm(nonNull) as Record<string, unknown>;

  // Carry over description/title/default from the parent wrapper.
  const result: Record<string, unknown> = { ...cleaned };
  for (const metaKey of ["description", "title", "default"]) {
    if (metaKey in obj && !(metaKey in result)) {
      result[metaKey] = obj[metaKey];
    }
  }

  return result;
}

function isNullSchema(node: unknown): boolean {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return false;
  }
  const record = node as Record<string, unknown>;
  return record.type === "null";
}
