type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Merge two arrays by matching entries on a key field.
 * - Entries with matching key → deep merge
 * - New entries → add
 * - Existing entries not in patch → keep unchanged
 */
function mergeArrayByKey(baseArray: unknown[], patchArray: unknown[], keyField: string): unknown[] {
  const result: unknown[] = [...baseArray];
  const baseMap = new Map<unknown, number>();

  // Build index of base array by key
  baseArray.forEach((item, index) => {
    if (isPlainObject(item) && keyField in item) {
      baseMap.set(item[keyField], index);
    }
  });

  // Process patch array
  for (const patchItem of patchArray) {
    if (!isPlainObject(patchItem) || !(keyField in patchItem)) {
      // Can't merge without key field; skip
      continue;
    }

    const key = patchItem[keyField];
    const existingIndex = baseMap.get(key);

    if (existingIndex !== undefined) {
      // Merge into existing entry
      result[existingIndex] = applyMergePatch(result[existingIndex], patchItem);
    } else {
      // New entry; add it
      result.push(patchItem);
      baseMap.set(key, result.length - 1);
    }
  }

  return result;
}

/**
 * Array fields that should be merged by key instead of replaced.
 * Format: { "path.to.array": "keyField" }
 */
const ARRAY_MERGE_PATHS: Record<string, string> = {
  "agents.list": "id",
};

export function applyMergePatch(base: unknown, patch: unknown, path: string = ""): unknown {
  if (!isPlainObject(patch)) {
    return patch;
  }

  const result: PlainObject = isPlainObject(base) ? { ...base } : {};

  for (const [key, value] of Object.entries(patch)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (value === null) {
      delete result[key];
      continue;
    }

    // Check if this is an array field that should be merged by key
    if (Array.isArray(value) && currentPath in ARRAY_MERGE_PATHS) {
      const keyField = ARRAY_MERGE_PATHS[currentPath];
      const baseValue = result[key];
      if (Array.isArray(baseValue)) {
        result[key] = mergeArrayByKey(baseValue, value, keyField);
      } else {
        result[key] = value;
      }
      continue;
    }

    if (isPlainObject(value)) {
      const baseValue = result[key];
      result[key] = applyMergePatch(isPlainObject(baseValue) ? baseValue : {}, value, currentPath);
      continue;
    }

    result[key] = value;
  }

  return result;
}
