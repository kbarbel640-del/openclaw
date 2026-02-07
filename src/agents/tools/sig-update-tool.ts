/**
 * sig update_and_sign tool — allows the LLM to update protected files
 * with provenance tracking.
 *
 * Protected files (soul.md, agents.md, etc.) cannot be modified with
 * write/edit — the mutation gate redirects the agent here. This tool
 * validates that the update traces back to an authorized, signed source
 * before allowing the change.
 */

import { findProjectRoot, updateAndSign } from "@disreguard/sig";
import { Type } from "@sinclair/typebox";
import type { MessageSigningContext } from "../message-signing.js";
import type { AnyAgentTool } from "./common.js";
import { stringEnum } from "../schema/typebox.js";
import { jsonResult, readStringParam } from "./common.js";

export interface SigUpdateToolOptions {
  /** Message signing context for provenance verification. */
  messageSigning?: MessageSigningContext;
  /** Session key for the current session. */
  sessionKey?: string;
  /** Current turn ID. */
  turnId?: string;
  /** Pre-built sender identity string (e.g. "owner:+1234567890:whatsapp"). */
  senderIdentity?: string;
}

const SOURCE_TYPES = ["signed_message", "signed_template"] as const;

const SigUpdateSchema = Type.Object({
  file: Type.String({
    description: "File path to update (relative to workspace root, e.g. 'soul.md').",
  }),
  content: Type.String({
    description: "New file content.",
  }),
  reason: Type.String({
    description: "Why this update is being made.",
  }),
  sourceType: stringEnum(SOURCE_TYPES, {
    description:
      "What type of source authorized this update. " +
      "'signed_message' for a signed owner message, 'signed_template' for a signed template instruction.",
  }),
  sourceId: Type.Optional(
    Type.String({
      description:
        "Signature ID of the source that authorized this change " +
        "(message signature ID for signed_message, template path for signed_template).",
    }),
  ),
});

// Lazily resolved project root (shared with verify tool pattern)
let resolvedProjectRoot: string | null | undefined;

async function getProjectRoot(): Promise<string | null> {
  if (resolvedProjectRoot !== undefined) {
    return resolvedProjectRoot;
  }
  try {
    resolvedProjectRoot = await findProjectRoot(process.cwd());
  } catch {
    resolvedProjectRoot = null;
  }
  return resolvedProjectRoot;
}

/**
 * Create the sig update_and_sign tool.
 * Owner-only: only available to authenticated owner senders.
 */
export function createSigUpdateTool(options?: SigUpdateToolOptions): AnyAgentTool {
  return {
    label: "Update and Sign",
    name: "update_and_sign",
    description:
      "Update a protected file (soul.md, agents.md, etc.) with provenance tracking. " +
      "Protected files cannot be modified with write or edit — use this tool instead. " +
      "You must provide the sourceId of the signed owner message that authorized the change.",
    parameters: SigUpdateSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const file = readStringParam(params, "file", { required: true });
      const content = readStringParam(params, "content", { required: true, trim: false });
      const reason = readStringParam(params, "reason", { required: true });
      const sourceType = readStringParam(params, "sourceType", { required: true }) as
        | "signed_message"
        | "signed_template";
      const sourceId = readStringParam(params, "sourceId");

      if (!options?.senderIdentity) {
        return jsonResult({
          approved: false,
          error: "No sender identity available. This tool requires an authenticated owner session.",
        });
      }

      const projectRoot = await getProjectRoot();
      if (!projectRoot) {
        return jsonResult({
          approved: false,
          error: "No .sig/ directory found in project. Cannot update protected files.",
        });
      }

      const result = await updateAndSign(projectRoot, file, content, {
        identity: options.senderIdentity,
        provenance: {
          sourceType,
          sourceId,
          sourceIdentity: options.senderIdentity,
          reason,
        },
        contentStore: options.messageSigning?.store,
      });

      return jsonResult(result);
    },
  };
}
