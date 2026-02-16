import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Operator {
  id: string;
  name: string;
  publicKey: string;
  phone: string;
  role: "owner" | "admin" | "operator";
  addedAt: string;
  addedBy: string;
}

export interface OperatorRegistry {
  version: number;
  operators: Operator[];
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_REGISTRY_PATH = join(
  homedir(),
  ".openclaw",
  "dem-auth",
  "operators.json",
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load the operator registry from disk.
 *
 * Resolution order:
 *   1. Explicit `path` argument.
 *   2. `DEM_AUTH_OPERATORS_PATH` environment variable.
 *   3. `~/.openclaw/dem-auth/operators.json`.
 *
 * @throws {Error} if the file cannot be read or parsed.
 */
export async function loadRegistry(path?: string): Promise<OperatorRegistry> {
  const filePath =
    path ?? process.env["DEM_AUTH_OPERATORS_PATH"] ?? DEFAULT_REGISTRY_PATH;

  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(
        `Operator registry not found at ${filePath}. ` +
          "Ensure operators.json exists or set DEM_AUTH_OPERATORS_PATH.",
      );
    }
    throw new Error(
      `Failed to read operator registry at ${filePath}: ${String(err)}`,
    );
  }

  let registry: OperatorRegistry;
  try {
    registry = JSON.parse(raw) as OperatorRegistry;
  } catch {
    throw new Error(
      `Operator registry at ${filePath} contains invalid JSON.`,
    );
  }

  if (!Array.isArray(registry.operators)) {
    throw new Error(
      `Operator registry at ${filePath} is missing the "operators" array.`,
    );
  }

  return registry;
}

/**
 * Find an operator by phone number.
 *
 * Phone numbers are compared after stripping all non-digit characters so that
 * formatting differences (spaces, dashes, plus signs) do not cause mismatches.
 */
export function findByPhone(
  registry: OperatorRegistry,
  phone: string,
): Operator | undefined {
  const normalized = normalizePhone(phone);
  return registry.operators.find(
    (op) => normalizePhone(op.phone) === normalized,
  );
}

/**
 * Find an operator by their hex-encoded Ed25519 public key.
 *
 * Comparison is case-insensitive.
 */
export function findByPublicKey(
  registry: OperatorRegistry,
  publicKey: string,
): Operator | undefined {
  const lower = publicKey.toLowerCase();
  return registry.operators.find(
    (op) => op.publicKey.toLowerCase() === lower,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}
