import type { ErrorObject } from "ajv";
import type { GateFailure, GateResult } from "./types.js";
import { compileSchemaCached } from "./ajv.js";

function toDollarPath(instancePath: string | undefined): string {
  const p = instancePath ?? "";
  if (!p) {
    return "$";
  }
  if (p.startsWith("/")) {
    return `$${p}`;
  }
  return `$/${p}`;
}

function stableAjvMessage(err: ErrorObject): { id: string; message: string; path: string } {
  const keyword = err.keyword;
  const basePath = toDollarPath(err.instancePath);

  if (keyword === "required") {
    const missing = (err.params as { missingProperty?: string } | undefined)?.missingProperty;
    const path = missing ? `${basePath}/${missing}` : basePath;
    return { id: "required", message: "is required", path };
  }

  if (keyword === "type") {
    const type = (err.params as { type?: string } | undefined)?.type;
    return { id: "type", message: type ? `must be ${type}` : "must match type", path: basePath };
  }

  if (keyword === "minLength") {
    const limit = (err.params as { limit?: number } | undefined)?.limit;
    return {
      id: "minLength",
      message: limit !== undefined ? `must have minLength ${limit}` : "minLength violated",
      path: basePath,
    };
  }

  if (keyword === "maxLength") {
    const limit = (err.params as { limit?: number } | undefined)?.limit;
    return {
      id: "maxLength",
      message: limit !== undefined ? `must have maxLength ${limit}` : "maxLength violated",
      path: basePath,
    };
  }

  if (keyword === "additionalProperties") {
    const prop = (err.params as { additionalProperty?: string } | undefined)?.additionalProperty;
    const path = prop ? `${basePath}/${prop}` : basePath;
    return { id: "additionalProperties", message: "additional properties not allowed", path };
  }

  if (keyword === "enum") {
    return { id: "enum", message: "must be one of the allowed values", path: basePath };
  }

  if (keyword === "const") {
    return { id: "const", message: "must match the required value", path: basePath };
  }

  return { id: keyword, message: "schema validation failed", path: basePath };
}

export function runSchemaGate(params: { artifact: unknown; schema: unknown }): GateResult {
  const validate = compileSchemaCached(params.schema);
  const ok = validate(params.artifact);
  if (ok) {
    return { ok: true };
  }

  const errors: ErrorObject[] = validate.errors ?? [];
  const failures: GateFailure[] = errors.map((err) => {
    const stable = stableAjvMessage(err);
    return {
      gate: "schema",
      id: stable.id,
      message: stable.message,
      path: stable.path,
      details: {
        schemaPath: err.schemaPath,
        params: err.params,
      },
    };
  });

  const sorted = failures.toSorted((a, b) => {
    const pa = a.path ?? "";
    const pb = b.path ?? "";
    if (pa !== pb) {
      return pa.localeCompare(pb);
    }
    if (a.id !== b.id) {
      return a.id.localeCompare(b.id);
    }
    const sa = (a.details as { schemaPath?: string } | undefined)?.schemaPath ?? "";
    const sb = (b.details as { schemaPath?: string } | undefined)?.schemaPath ?? "";
    return sa.localeCompare(sb);
  });

  return { ok: false, failures: sorted };
}
