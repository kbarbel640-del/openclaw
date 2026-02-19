/**
 * Resolve CLOUDRU_IAM_SECRET reliably from multiple sources.
 *
 * Checks in order:
 * 1. process.env.CLOUDRU_IAM_SECRET (set by dotenv at startup or manually)
 * 2. CWD .env file (direct parse, no dotenv dependency)
 * 3. ~/.openclaw/.env (global fallback)
 *
 * This ensures plugins always find the secret regardless of whether
 * dotenv ran, CWD changed, or the var was set via onboard wizard.
 *
 * Reusable across: plugins, CLI commands, health endpoints.
 */

import fs from "node:fs";
import path from "node:path";
import { resolveConfigDir } from "../utils.js";

export function resolveIamSecret(): string {
  // 1. Already in process.env (fastest path)
  const fromEnv = process.env.CLOUDRU_IAM_SECRET?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  // 2. Parse from CWD .env
  const cwdEnv = path.join(process.cwd(), ".env");
  const fromCwd = parseEnvFileValue(cwdEnv, "CLOUDRU_IAM_SECRET");
  if (fromCwd) {
    // Cache in process.env for subsequent calls
    process.env.CLOUDRU_IAM_SECRET = fromCwd;
    return fromCwd;
  }

  // 3. Parse from global state dir .env
  const globalEnv = path.join(resolveConfigDir(), ".env");
  const fromGlobal = parseEnvFileValue(globalEnv, "CLOUDRU_IAM_SECRET");
  if (fromGlobal) {
    process.env.CLOUDRU_IAM_SECRET = fromGlobal;
    return fromGlobal;
  }

  return "";
}

function parseEnvFileValue(filePath: string, key: string): string {
  try {
    if (!fs.existsSync(filePath)) {
      return "";
    }
    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }
      const eqIdx = trimmed.indexOf("=");
      const k = trimmed.slice(0, eqIdx).trim();
      if (k === key) {
        let v = trimmed.slice(eqIdx + 1).trim();
        // Strip surrounding quotes
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        return v;
      }
    }
  } catch {
    // File read error — skip
  }
  return "";
}
