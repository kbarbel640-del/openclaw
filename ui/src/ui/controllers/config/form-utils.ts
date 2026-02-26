/**
 * Check if a string looks like a large integer (> MAX_SAFE_INTEGER) that should be preserved as a string.
 * Discord snowflake IDs exceed JavaScript's safe integer range and must be kept as strings to avoid precision loss.
 */
function looksLikeLargeInteger(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length < 16) {
    return false;
  }
  // Large integers (> Number.MAX_SAFE_INTEGER = 9007199254740991) have 16+ digits
  // Check if it's a valid integer string that would lose precision if converted to number
  if (/^-?\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    return Number.isFinite(num) && Math.abs(num) > Number.MAX_SAFE_INTEGER;
  }
  return false;
}

/**
 * Deep clone an object while preserving large integer strings that would lose precision
 * if converted to JavaScript numbers (e.g., Discord snowflake IDs).
 */
function cloneWithLargeIntPreservation(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    // Preserve large integer strings to avoid precision loss
    if (looksLikeLargeInteger(value)) {
      return value;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(cloneWithLargeIntPreservation);
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = cloneWithLargeIntPreservation(val);
    }
    return result;
  }

  return value;
}

export function cloneConfigObject<T>(value: T): T {
  if (typeof structuredClone === "function") {
    // structuredClone doesn't lose precision for large integers in strings
    return structuredClone(value);
  }
  // Fallback: use custom clone that preserves large integer strings
  return cloneWithLargeIntPreservation(value) as T;
}

export function serializeConfigForm(form: Record<string, unknown>): string {
  return `${JSON.stringify(form, null, 2).trimEnd()}\n`;
}

export function setPathValue(
  obj: Record<string, unknown> | unknown[],
  path: Array<string | number>,
  value: unknown,
) {
  if (path.length === 0) {
    return;
  }
  let current: Record<string, unknown> | unknown[] = obj;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    const nextKey = path[i + 1];
    if (typeof key === "number") {
      if (!Array.isArray(current)) {
        return;
      }
      if (current[key] == null) {
        current[key] = typeof nextKey === "number" ? [] : ({} as Record<string, unknown>);
      }
      current = current[key] as Record<string, unknown> | unknown[];
    } else {
      if (typeof current !== "object" || current == null) {
        return;
      }
      const record = current as Record<string, unknown>;
      if (record[key] == null) {
        record[key] = typeof nextKey === "number" ? [] : ({} as Record<string, unknown>);
      }
      current = record[key] as Record<string, unknown> | unknown[];
    }
  }
  const lastKey = path[path.length - 1];
  if (typeof lastKey === "number") {
    if (Array.isArray(current)) {
      current[lastKey] = value;
    }
    return;
  }
  if (typeof current === "object" && current != null) {
    (current as Record<string, unknown>)[lastKey] = value;
  }
}

export function removePathValue(
  obj: Record<string, unknown> | unknown[],
  path: Array<string | number>,
) {
  if (path.length === 0) {
    return;
  }
  let current: Record<string, unknown> | unknown[] = obj;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    if (typeof key === "number") {
      if (!Array.isArray(current)) {
        return;
      }
      current = current[key] as Record<string, unknown> | unknown[];
    } else {
      if (typeof current !== "object" || current == null) {
        return;
      }
      current = (current as Record<string, unknown>)[key] as Record<string, unknown> | unknown[];
    }
    if (current == null) {
      return;
    }
  }
  const lastKey = path[path.length - 1];
  if (typeof lastKey === "number") {
    if (Array.isArray(current)) {
      current.splice(lastKey, 1);
    }
    return;
  }
  if (typeof current === "object" && current != null) {
    delete (current as Record<string, unknown>)[lastKey];
  }
}
