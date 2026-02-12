import fs from "node:fs/promises";
import path from "node:path";
import { STATE_DIR } from "../config/paths.js";
import { resolveWorkspaceTemplateDir } from "./workspace-templates.js";

export const GLOBAL_RULES_FILENAME = "RULES.md";
export const STRICT_RULES_FILENAME = "STRICT_RULES.md";

// Cache for strict rules (loaded once from package templates).
let cachedStrictRules: string | undefined;

/**
 * Load strict rules from the package template directory (docs/reference/templates/STRICT_RULES.md).
 * Cached after first load — content ships with the package and doesn't change at runtime.
 */
export async function loadStrictRules(templateDir?: string): Promise<string | undefined> {
  if (cachedStrictRules !== undefined) return cachedStrictRules || undefined;
  const dir = templateDir ?? (await resolveWorkspaceTemplateDir());
  const rulesPath = path.join(dir, STRICT_RULES_FILENAME);
  try {
    const raw = await fs.readFile(rulesPath, "utf-8");
    // Strip optional front matter (same pattern as workspace.ts:stripFrontMatter)
    let content = raw;
    if (content.startsWith("---")) {
      const endIndex = content.indexOf("\n---", 3);
      if (endIndex !== -1) {
        content = content.slice(endIndex + "\n---".length).replace(/^\s+/, "");
      }
    }
    cachedStrictRules = content.trim();
    return cachedStrictRules || undefined;
  } catch {
    cachedStrictRules = "";
    return undefined;
  }
}

/**
 * Load operator rules from the global state directory (~/.openclaw/RULES.md).
 * NOT a workspace file — applies to all agents regardless of workspace.
 */
export async function loadGlobalRules(stateDir: string = STATE_DIR): Promise<string | undefined> {
  const rulesPath = path.join(stateDir, GLOBAL_RULES_FILENAME);
  try {
    const content = await fs.readFile(rulesPath, "utf-8");
    const trimmed = content.trim();
    return trimmed || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Ensure ~/.openclaw/RULES.md exists, creating it from the template if missing.
 * Called during workspace setup so operators have a visible file to edit.
 */
export async function ensureGlobalRulesFile(stateDir: string = STATE_DIR): Promise<void> {
  const rulesPath = path.join(stateDir, GLOBAL_RULES_FILENAME);
  try {
    await fs.access(rulesPath);
    // Already exists — don't overwrite.
    return;
  } catch {
    // Missing — create from template.
  }
  try {
    const templateDir = await resolveWorkspaceTemplateDir();
    const templatePath = path.join(templateDir, GLOBAL_RULES_FILENAME);
    const raw = await fs.readFile(templatePath, "utf-8");
    // Strip front matter before writing the user-facing file.
    let content = raw;
    if (content.startsWith("---")) {
      const endIndex = content.indexOf("\n---", 3);
      if (endIndex !== -1) {
        content = content.slice(endIndex + "\n---".length).replace(/^\s+/, "");
      }
    }
    await fs.mkdir(stateDir, { recursive: true });
    await fs.writeFile(rulesPath, content, { encoding: "utf-8", flag: "wx" });
  } catch {
    // Template missing or write race — silently skip.
  }
}

/** Reset the strict rules cache (for testing). */
export function resetStrictRulesCache(): void {
  cachedStrictRules = undefined;
}
