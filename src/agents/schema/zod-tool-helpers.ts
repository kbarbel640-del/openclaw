import { z } from "zod";
import { zodToToolJsonSchema } from "./zod-tool-schema.js";

/**
 * Zod-based schema helpers for LLM tool definitions.
 * Drop-in replacements for the TypeBox helpers in typebox.ts.
 */

type ZodStringEnumOptions = {
  description?: string;
  title?: string;
  default?: string;
};

/**
 * Create a Zod enum from a readonly string array.
 * Produces LLM-compatible JSON Schema (no anyOf, clean enum).
 *
 * @example
 * const Mode = zodStringEnum(["fast", "balanced", "creative"] as const);
 * type ModeType = z.infer<typeof Mode>; // "fast" | "balanced" | "creative"
 */
export function zodStringEnum<T extends readonly [string, ...string[]]>(
  values: T,
  options?: ZodStringEnumOptions,
) {
  // Cast to the expected tuple type for z.enum
  const enumValues = values as unknown as [T[number], ...T[number][]];
  let schema = z.enum(enumValues);

  if (!options) {
    return schema;
  }

  // Apply description if provided
  if (options.description) {
    schema = schema.describe(options.description);
  }

  // Apply default if provided — returns ZodDefault<ZodEnum<...>> (wider type)
  if (options.default !== undefined) {
    return schema.default(options.default as T[number]);
  }

  return schema;
}

/**
 * Create an optional Zod enum from a readonly string array.
 *
 * @example
 * const OptionalMode = zodOptionalStringEnum(["fast", "balanced"] as const);
 * type OptionalModeType = z.infer<typeof OptionalMode>; // "fast" | "balanced" | undefined
 */
export function zodOptionalStringEnum<T extends readonly [string, ...string[]]>(
  values: T,
  options?: ZodStringEnumOptions,
) {
  return zodStringEnum(values, options).optional();
}

// Re-export the core transformer
export { zodToToolJsonSchema } from "./zod-tool-schema.js";
