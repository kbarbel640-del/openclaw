import type { ValidateFunction } from "ajv";
import * as Ajv2020Mod from "ajv/dist/2020.js";
import crypto from "node:crypto";

type AjvCtor = new (opts?: unknown) => { compile: (schema: object) => ValidateFunction };
const Ajv2020 = (Ajv2020Mod as unknown as { default: AjvCtor }).default;

// Canonical JSON: deterministic stringify with recursively sorted object keys.
export function canonicalJson(value: unknown): string {
  const normalize = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      return v.map((x) => normalize(x));
    }
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(obj).toSorted()) {
        out[k] = normalize(obj[k]);
      }
      return out;
    }
    return v;
  };

  return JSON.stringify(normalize(value));
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

const ajvSingleton = new Ajv2020({
  allErrors: true,
  strict: false,
  allowUnionTypes: true,
});

const compiledByKey = new Map<string, ValidateFunction>();

export function compileSchemaCached(schema: unknown): ValidateFunction {
  const key = sha256Hex(canonicalJson(schema));
  const hit = compiledByKey.get(key);
  if (hit) {
    return hit;
  }
  const validate = ajvSingleton.compile(schema as object);
  compiledByKey.set(key, validate);
  return validate;
}
