/**
 * Environment variable reference preservation for config writes.
 *
 * When config is read, ${VAR} references are resolved to actual values.
 * This module tracks those references so they can be restored when writing
 * config back, preventing plaintext exposure of sensitive values.
 */

// Pattern for env var references: ${UPPERCASE_VAR}
const ENV_VAR_PATTERN = /\$\{([A-Z_][A-Z0-9_]*)\}/g;

type EnvVarReference = {
  path: string;
  varName: string;
  originalValue: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function collectEnvVarRefsFromValue(value: unknown, path: string, refs: EnvVarReference[]): void {
  if (typeof value === "string") {
    // Check if the entire string is a single env var reference
    const match = value.match(/^\$\{([A-Z_][A-Z0-9_]*)\}$/);
    if (match) {
      refs.push({
        path,
        varName: match[1],
        originalValue: value,
      });
      return;
    }
    // Check for env vars embedded in strings
    ENV_VAR_PATTERN.lastIndex = 0;
    let matchResult: RegExpExecArray | null;
    while ((matchResult = ENV_VAR_PATTERN.exec(value)) !== null) {
      refs.push({
        path,
        varName: matchResult[1],
        originalValue: value,
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      collectEnvVarRefsFromValue(value[i], `${path}[${i}]`, refs);
    }
    return;
  }

  if (isPlainObject(value)) {
    for (const [key, val] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      collectEnvVarRefsFromValue(val, childPath, refs);
    }
  }
}

/**
 * Collects all env var references from a raw config object (before substitution).
 * Returns a list of references with their paths and original values.
 */
export function collectEnvVarReferences(rawConfig: unknown): EnvVarReference[] {
  const refs: EnvVarReference[] = [];
  collectEnvVarRefsFromValue(rawConfig, "", refs);
  return refs;
}

function getValueAtPath(obj: unknown, path: string): unknown {
  if (!path) {
    return obj;
  }

  const parts = path.split(/\.|\[|\]/).filter(Boolean);
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (Array.isArray(current)) {
      const index = Number.parseInt(part, 10);
      if (!Number.isFinite(index)) {
        return undefined;
      }
      current = current[index];
    } else if (isPlainObject(current)) {
      current = current[part];
    } else {
      return undefined;
    }
  }

  return current;
}

function setValueAtPath(obj: unknown, path: string, value: unknown): boolean {
  if (!path || !isPlainObject(obj)) {
    return false;
  }

  const parts = path.split(/\.|\[|\]/).filter(Boolean);
  let current: unknown = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (Array.isArray(current)) {
      const index = Number.parseInt(part, 10);
      if (!Number.isFinite(index)) {
        return false;
      }
      current = current[index];
    } else if (isPlainObject(current)) {
      current = current[part];
    } else {
      return false;
    }
  }

  const lastPart = parts[parts.length - 1];
  if (Array.isArray(current)) {
    const index = Number.parseInt(lastPart, 10);
    if (!Number.isFinite(index)) {
      return false;
    }
    current[index] = value;
    return true;
  }
  if (isPlainObject(current)) {
    current[lastPart] = value;
    return true;
  }
  return false;
}

/**
 * Creates a map of paths to their original raw values for env var references.
 * Used for more precise restoration when multiple references exist at the same path.
 */
export function createEnvVarPreservationMap(rawConfig: unknown): Map<string, string> {
  const map = new Map<string, string>();
  const refs = collectEnvVarReferences(rawConfig);

  for (const ref of refs) {
    // Store only the first reference per path (original value)
    if (!map.has(ref.path)) {
      map.set(ref.path, ref.originalValue);
    }
  }

  return map;
}

/**
 * Restores env var references using a preservation map.
 * More efficient for repeated writes as the map can be computed once.
 *
 * @param config - The config object to restore references in (cloned before modification)
 * @param preservationMap - Map of paths to original values with env var references
 * @param env - Environment variables to check resolved values against
 * @returns A new config object with env var references restored
 */
export function restoreFromPreservationMap(
  config: unknown,
  preservationMap: Map<string, string>,
  env: NodeJS.ProcessEnv = process.env,
): unknown {
  if (!isPlainObject(config) || preservationMap.size === 0) {
    return config;
  }

  // Clone to avoid mutating the original
  const result = structuredClone(config);

  for (const [path, originalValue] of preservationMap) {
    const currentValue = getValueAtPath(result, path);
    if (typeof currentValue !== "string") {
      continue;
    }

    // Calculate what the original value would resolve to
    let expectedResolved = originalValue;
    ENV_VAR_PATTERN.lastIndex = 0;
    let matchResult: RegExpExecArray | null;
    while ((matchResult = ENV_VAR_PATTERN.exec(originalValue)) !== null) {
      const varValue = env[matchResult[1]];
      if (varValue !== undefined && varValue !== "") {
        expectedResolved = expectedResolved.replace(matchResult[0], varValue);
      }
    }
    ENV_VAR_PATTERN.lastIndex = 0;

    // Only restore if the current value matches what we expect
    if (currentValue === expectedResolved) {
      setValueAtPath(result, path, originalValue);
    }
  }

  return result;
}
