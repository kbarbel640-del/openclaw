/**
 * Workspace signature initialization.
 *
 * Signs workspace files that have mutable sig file policies but no existing
 * signatures. This establishes the initial chain anchor so that subsequent
 * updates via update_and_sign can be validated.
 *
 * Called during first agent run for a session. Uses identity "workspace:init"
 * which is a bootstrap identity — authorizedIdentities in the file policy
 * constrains who can *update*, not who originally signed.
 */

import { loadConfig, checkFile, signFile, type SigConfig } from "@disreguard/sig";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("agents/sig-workspace-init");

const INIT_IDENTITY = "workspace:init";

export interface WorkspaceInitResult {
  signed: string[];
  alreadySigned: string[];
  skipped: string[];
}

/**
 * Sign any workspace files that have sig file policies with mutable: true
 * but no existing signatures. Idempotent — safe to call on every session start.
 */
export async function initWorkspaceSignatures(
  projectRoot: string,
  config?: SigConfig | null,
): Promise<WorkspaceInitResult> {
  const sigConfig = config ?? (await loadConfig(projectRoot));
  if (!sigConfig?.files) {
    return { signed: [], alreadySigned: [], skipped: [] };
  }

  const result: WorkspaceInitResult = { signed: [], alreadySigned: [], skipped: [] };

  for (const [pattern, policy] of Object.entries(sigConfig.files)) {
    if (!policy.mutable) {
      continue;
    }

    // Only handle exact file paths (not globs) for workspace init
    if (pattern.includes("*")) {
      continue;
    }

    try {
      const check = await checkFile(projectRoot, pattern);
      if (check.status === "signed") {
        result.alreadySigned.push(pattern);
      } else if (check.status === "unsigned") {
        await signFile(projectRoot, pattern, { identity: INIT_IDENTITY });
        result.signed.push(pattern);
        log.info(`Signed workspace file: ${pattern}`);
      } else {
        // modified or corrupted — skip, don't overwrite
        result.skipped.push(pattern);
        log.debug(`Skipped ${pattern}: status is ${check.status}`);
      }
    } catch (err) {
      result.skipped.push(pattern);
      log.debug(`Skipped ${pattern}: ${String(err)}`);
    }
  }

  return result;
}
