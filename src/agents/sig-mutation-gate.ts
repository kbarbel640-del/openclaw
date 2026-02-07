/**
 * Mutation gate for sig-protected files.
 *
 * Intercepts write/edit tool calls targeting files with sig file policies
 * (mutable: true) and blocks them, directing the agent to use update_and_sign
 * instead. This ensures all modifications to protected files go through
 * provenance validation.
 *
 * Runs in the before-tool-call hook pipeline, after the verification gate
 * and before plugin hooks. Both gates are deterministic orchestrator-level
 * code that cannot be bypassed by prompt injection.
 */

import { resolveFilePolicy, type SigConfig } from "@disreguard/sig";
import { resolve, relative } from "node:path";

export type MutationGateResult = { blocked: false } | { blocked: true; reason: string };

/** Tools that write files and should be checked against file policies. */
const MUTATION_GATED_TOOLS = new Set(["write", "edit"]);

/**
 * Check whether a tool call targets a sig-protected mutable file.
 * If so, block it and instruct the agent to use update_and_sign.
 *
 * Only applies to `write` and `edit` tools. `apply_patch` is excluded
 * because its file paths are embedded in the patch content (not a simple
 * parameter) and it's already behind the verification gate.
 */
export function checkMutationGate(
  toolName: string,
  toolArgs: unknown,
  projectRoot: string | undefined,
  sigConfig: SigConfig | null | undefined,
): MutationGateResult {
  const normalized = toolName.trim().toLowerCase();
  if (!MUTATION_GATED_TOOLS.has(normalized)) {
    return { blocked: false };
  }

  if (!projectRoot || !sigConfig?.files) {
    return { blocked: false };
  }

  const args = toolArgs as Record<string, unknown> | undefined;
  if (!args) {
    return { blocked: false };
  }

  // Extract target path — handle both raw and normalized param names
  const targetPath =
    typeof args.path === "string"
      ? args.path
      : typeof args.file_path === "string"
        ? args.file_path
        : typeof args.filePath === "string"
          ? args.filePath
          : undefined;

  if (!targetPath) {
    return { blocked: false };
  }

  // Resolve to a path relative to the project root
  const absolutePath = resolve(projectRoot, targetPath);
  const relativePath = relative(projectRoot, absolutePath);

  // Don't check paths outside the project root
  if (relativePath.startsWith("..")) {
    return { blocked: false };
  }

  const policy = resolveFilePolicy(sigConfig, relativePath);
  if (!policy.mutable) {
    return { blocked: false };
  }

  // File is protected and mutable — block direct writes
  const requiresSignedSource = policy.requireSignedSource !== false;
  const sourceNote = requiresSignedSource
    ? " Required: sourceType must be 'signed_message' with a valid sourceId referencing a signed owner message that authorized this change."
    : "";

  return {
    blocked: true,
    reason: `${relativePath} is protected by a sig file policy. Use the update_and_sign tool to modify it.${sourceNote}`,
  };
}
