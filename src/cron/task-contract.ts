/**
 * Task Contract — validates job outputs against declared schemas.
 *
 * Contracts define what a job MUST produce, preventing model/tool drift
 * in multi-step pipelines. When a job declares a taskContract, its output
 * is validated before being passed to child jobs or delivered.
 */

import type { CronTaskContract } from "./types.js";

export type ContractValidationResult = {
  valid: boolean;
  errors: string[];
};

/** Extract structured data from agent output (JSON blocks or key:value pairs). */
export function extractStructuredOutput(output: string): Record<string, unknown> | null {
  if (!output || typeof output !== "string") {
    return null;
  }

  // 1. Try JSON in markdown code blocks (```json ... ```)
  const codeBlockMatch = output.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
  if (codeBlockMatch?.[1]) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through
    }
  }

  // 2. Try raw JSON (first { to last })
  const firstBrace = output.indexOf("{");
  const lastBrace = output.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const candidate = output.slice(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through
    }
  }

  // 3. Fall back to key:value pair extraction
  const kvResult: Record<string, unknown> = {};
  let found = false;
  const lines = output.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // Match "key: value" or "key = value" patterns
    const kvMatch = trimmed.match(/^([a-zA-Z_][\w.]*)\s*[:=]\s*(.+)$/);
    if (kvMatch?.[1] && kvMatch[2]) {
      const key = kvMatch[1];
      let value: unknown = kvMatch[2].trim();

      // Try to parse value as JSON primitive
      if (value === "true") {
        value = true;
      } else if (value === "false") {
        value = false;
      } else if (value === "null") {
        value = null;
      } else {
        const num = Number(value);
        if (!Number.isNaN(num) && String(num) === value) {
          value = num;
        }
      }

      kvResult[key] = value;
      found = true;
    }
  }

  return found ? kvResult : null;
}

function checkTypeMatch(value: unknown, expectedType: unknown): boolean {
  if (typeof expectedType !== "string") {
    return true; // can't validate unknown schema types
  }
  switch (expectedType) {
    case "string":
      return typeof value === "string";
    case "number":
    case "integer":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return value !== null && typeof value === "object" && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    case "null":
      return value === null;
    default:
      return true;
  }
}

function validateAgainstSchema(
  data: Record<string, unknown>,
  schema: Record<string, unknown>,
): string[] {
  const errors: string[] = [];

  // Check required fields from schema.required
  const required = schema.required;
  if (Array.isArray(required)) {
    for (const field of required) {
      if (typeof field === "string" && !(field in data)) {
        errors.push(`missing required field: ${field}`);
      }
    }
  }

  // Check property types from schema.properties
  const properties = schema.properties;
  if (properties && typeof properties === "object" && !Array.isArray(properties)) {
    const props = properties as Record<string, unknown>;
    for (const [key, propSchema] of Object.entries(props)) {
      if (!(key in data)) {
        continue;
      }
      const propDef = propSchema as Record<string, unknown> | null;
      if (propDef && typeof propDef === "object" && "type" in propDef) {
        if (!checkTypeMatch(data[key], propDef.type)) {
          errors.push(
            `field "${key}": expected type ${String(propDef.type)}, got ${typeof data[key]}`,
          );
        }
      }
    }
  }

  return errors;
}

/** Validate job output against a task contract. */
export function validateTaskOutput(
  output: string,
  contract: CronTaskContract,
): ContractValidationResult {
  const errors: string[] = [];

  if (!output || typeof output !== "string") {
    return { valid: false, errors: ["output is empty or not a string"] };
  }

  const data = extractStructuredOutput(output);
  if (!data) {
    // If there are required fields or an output schema, structured data is needed
    if (
      (contract.requiredOutputFields && contract.requiredOutputFields.length > 0) ||
      contract.outputSchema
    ) {
      return { valid: false, errors: ["could not extract structured data from output"] };
    }
    return { valid: true, errors: [] };
  }

  // Check required output fields
  if (contract.requiredOutputFields) {
    for (const field of contract.requiredOutputFields) {
      if (!(field in data)) {
        errors.push(`missing required output field: ${field}`);
      }
    }
  }

  // Check output schema
  if (contract.outputSchema) {
    const schemaErrors = validateAgainstSchema(data, contract.outputSchema);
    errors.push(...schemaErrors);
  }

  return { valid: errors.length === 0, errors };
}

/** Validate input from parent job against contract's input schema. */
export function validateTaskInput(
  input: string,
  contract: CronTaskContract,
): ContractValidationResult {
  const errors: string[] = [];

  if (!input || typeof input !== "string") {
    if (contract.inputSchema) {
      return { valid: false, errors: ["input is empty or not a string"] };
    }
    return { valid: true, errors: [] };
  }

  if (!contract.inputSchema) {
    return { valid: true, errors: [] };
  }

  const data = extractStructuredOutput(input);
  if (!data) {
    return { valid: false, errors: ["could not extract structured data from input"] };
  }

  const schemaErrors = validateAgainstSchema(data, contract.inputSchema);
  errors.push(...schemaErrors);

  return { valid: errors.length === 0, errors };
}
