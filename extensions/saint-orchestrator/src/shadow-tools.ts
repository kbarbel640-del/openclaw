import type { AnyAgentTool } from "openclaw/plugin-sdk";
import { Type } from "@sinclair/typebox";
import fs from "node:fs/promises";
import path from "node:path";
import { jsonResult, readStringParam } from "openclaw/plugin-sdk";
import { applyPatch } from "../../../src/agents/apply-patch.js";
import { parseJsonSafe, resolveWorkspaceDir, uniqueStrings } from "./normalize.js";
import { canReadPath, canWritePath, isConfigManagedPath, needsConfigValidation, resolveRealPathWithinWorkspace } from "./policy.js";
import { resolveTierForToolContext } from "./sessions.js";
import type { ResolvedTier, SaintToolContext, ToolExecutionResult } from "./types.js";
import { payloadHash, requireWriteConfirmation, validateConfigWrite } from "./validation.js";

export function resolvePathParam(params: Record<string, unknown>): string {
  const direct = readStringParam(params, "path");
  if (direct) {
    return direct;
  }
  const alias = readStringParam(params, "file_path");
  if (alias) {
    return alias;
  }
  return "";
}

export function parsePatchPaths(input: string): string[] {
  const paths: string[] = [];
  const prefixes = ["*** Add File: ", "*** Delete File: ", "*** Update File: ", "*** Move to: "];
  for (const line of input.split(/\r?\n/)) {
    for (const prefix of prefixes) {
      if (!line.startsWith(prefix)) {
        continue;
      }
      const value = line.slice(prefix.length).trim();
      if (value) {
        paths.push(value);
      }
    }
  }
  return uniqueStrings(paths);
}

export function extractJsonResultPayload(result: unknown): Record<string, unknown> | null {
  if (!result || typeof result !== "object") {
    return null;
  }
  const details = (result as { details?: unknown }).details;
  if (details && typeof details === "object") {
    return details as Record<string, unknown>;
  }

  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    return null;
  }
  const textBlock = content.find(
    (entry) => entry && typeof entry === "object" && (entry as { type?: unknown }).type === "text",
  ) as { text?: unknown } | undefined;
  if (!textBlock || typeof textBlock.text !== "string") {
    return null;
  }
  const parsed = parseJsonSafe<Record<string, unknown>>(textBlock.text);
  return parsed;
}

export function applyJsonPayloadResult(result: unknown, payload: Record<string, unknown>) {
  if (!result || typeof result !== "object") {
    return jsonResult(payload);
  }
  const content = (result as { content?: unknown }).content;
  if (Array.isArray(content)) {
    const nextContent = content.map((entry) => {
      if (
        entry &&
        typeof entry === "object" &&
        (entry as { type?: unknown }).type === "text" &&
        typeof (entry as { text?: unknown }).text === "string"
      ) {
        return {
          ...(entry as Record<string, unknown>),
          text: JSON.stringify(payload, null, 2),
        };
      }
      return entry;
    });
    return {
      ...(result as Record<string, unknown>),
      content: nextContent,
      details: payload,
    };
  }
  return jsonResult(payload);
}

export function createShadowReadTool(
  ctx: SaintToolContext,
  original: AnyAgentTool | null | undefined,
): AnyAgentTool {
  return createCallThroughShadowTool({
    name: "read",
    ctx,
    original,
    precheck: async (_tier, args) => {
      const inputPath = resolvePathParam(args);
      if (!inputPath) {
        throw new Error("path required");
      }
      const workspaceDir = resolveWorkspaceDir(ctx);
      if (!workspaceDir) {
        throw new Error("workspace path unavailable");
      }
      const tier = await resolveTierForToolContext(ctx);
      const resolved = await resolveRealPathWithinWorkspace(workspaceDir, inputPath);
      if (!canReadPath(tier, resolved.rel)) {
        throw new Error(`read denied for path: ${resolved.rel}`);
      }
    },
  });
}

export function createShadowWriteTool(ctx: SaintToolContext): AnyAgentTool {
  return {
    name: "write",
    label: "Write",
    description: "Write files to the real workspace with tier path scoping.",
    parameters: Type.Object({
      path: Type.Optional(Type.String()),
      file_path: Type.Optional(Type.String()),
      content: Type.String(),
      confirmToken: Type.Optional(Type.String()),
    }),
    execute: async (_toolCallId, rawParams) => {
      const params = (rawParams as Record<string, unknown>) ?? {};
      const inputPath = resolvePathParam(params);
      if (!inputPath) {
        throw new Error("path required");
      }
      const content = readStringParam(params, "content", { required: true }) ?? "";
      const confirmToken = readStringParam(params, "confirmToken");
      const workspaceDir = resolveWorkspaceDir(ctx);
      if (!workspaceDir) {
        throw new Error("workspace path unavailable");
      }

      const tier = await resolveTierForToolContext(ctx);
      const resolved = await resolveRealPathWithinWorkspace(workspaceDir, inputPath);
      if (!canWritePath(tier, resolved.rel)) {
        throw new Error(`write denied for path: ${resolved.rel}`);
      }

      if (isConfigManagedPath(resolved.rel)) {
        const confirmation = requireWriteConfirmation({
          workspaceDir,
          sessionKey: ctx.sessionKey,
          relPath: resolved.rel,
          contentHash: payloadHash(content),
          confirmToken,
        });
        if (!confirmation.ok) {
          throw new Error(confirmation.errors.join("; "));
        }
      }

      if (needsConfigValidation(resolved.rel)) {
        const validation = await validateConfigWrite({
          workspaceDir,
          relPath: resolved.rel,
          content,
        });
        if (!validation.ok) {
          throw new Error(`config validation failed: ${validation.errors.join("; ")}`);
        }
      }

      await fs.mkdir(path.dirname(resolved.abs), { recursive: true });
      await fs.writeFile(resolved.abs, content, "utf-8");
      return jsonResult({ ok: true, action: "write", path: resolved.rel });
    },
  };
}

export function createShadowEditTool(ctx: SaintToolContext): AnyAgentTool {
  return {
    name: "edit",
    label: "Edit",
    description: "Edit files in the real workspace with tier path scoping.",
    parameters: Type.Object({
      path: Type.Optional(Type.String()),
      file_path: Type.Optional(Type.String()),
      oldText: Type.Optional(Type.String()),
      old_string: Type.Optional(Type.String()),
      newText: Type.Optional(Type.String()),
      new_string: Type.Optional(Type.String()),
      confirmToken: Type.Optional(Type.String()),
    }),
    execute: async (_toolCallId, rawParams) => {
      const params = (rawParams as Record<string, unknown>) ?? {};
      const inputPath = resolvePathParam(params);
      if (!inputPath) {
        throw new Error("path required");
      }
      const oldText =
        readStringParam(params, "oldText") ?? readStringParam(params, "old_string") ?? "";
      const newText =
        readStringParam(params, "newText") ?? readStringParam(params, "new_string") ?? "";
      const confirmToken = readStringParam(params, "confirmToken");
      if (!oldText) {
        throw new Error("oldText required");
      }

      const workspaceDir = resolveWorkspaceDir(ctx);
      if (!workspaceDir) {
        throw new Error("workspace path unavailable");
      }
      const tier = await resolveTierForToolContext(ctx);
      const resolved = await resolveRealPathWithinWorkspace(workspaceDir, inputPath);
      if (!canWritePath(tier, resolved.rel)) {
        throw new Error(`edit denied for path: ${resolved.rel}`);
      }

      const existing = await fs.readFile(resolved.abs, "utf-8");
      if (!existing.includes(oldText)) {
        throw new Error("oldText not found");
      }
      // Verify oldText is unique to prevent ambiguous edits (matches platform edit tool behavior)
      const firstIdx = existing.indexOf(oldText);
      const secondIdx = existing.indexOf(oldText, firstIdx + 1);
      if (secondIdx !== -1) {
        throw new Error(
          "oldText appears multiple times in file — provide more context to make it unique",
        );
      }
      const updated = existing.replace(oldText, newText);

      if (isConfigManagedPath(resolved.rel)) {
        const confirmation = requireWriteConfirmation({
          workspaceDir,
          sessionKey: ctx.sessionKey,
          relPath: resolved.rel,
          contentHash: payloadHash(updated),
          confirmToken,
        });
        if (!confirmation.ok) {
          throw new Error(confirmation.errors.join("; "));
        }
      }

      if (needsConfigValidation(resolved.rel)) {
        const validation = await validateConfigWrite({
          workspaceDir,
          relPath: resolved.rel,
          content: updated,
        });
        if (!validation.ok) {
          throw new Error(`config validation failed: ${validation.errors.join("; ")}`);
        }
      }

      await fs.writeFile(resolved.abs, updated, "utf-8");
      return jsonResult({ ok: true, action: "edit", path: resolved.rel });
    },
  };
}

export function createShadowApplyPatchTool(ctx: SaintToolContext): AnyAgentTool {
  return {
    name: "apply_patch",
    label: "apply_patch",
    description: "Apply patch with workspace/tier path scoping.",
    parameters: Type.Object({
      input: Type.Optional(Type.String()),
      patch: Type.Optional(Type.String()),
      confirmToken: Type.Optional(Type.String()),
    }),
    execute: async (_toolCallId, rawParams) => {
      const params = (rawParams as Record<string, unknown>) ?? {};
      const patchInput = readStringParam(params, "input") ?? readStringParam(params, "patch") ?? "";
      if (!patchInput.trim()) {
        throw new Error("input required");
      }

      const workspaceDir = resolveWorkspaceDir(ctx);
      if (!workspaceDir) {
        throw new Error("workspace path unavailable");
      }
      const tier = await resolveTierForToolContext(ctx);
      const touched = parsePatchPaths(patchInput);
      if (touched.length === 0) {
        throw new Error("patch did not include any file hunks");
      }

      for (const touchedPath of touched) {
        const resolved = await resolveRealPathWithinWorkspace(workspaceDir, touchedPath);
        if (!canWritePath(tier, resolved.rel)) {
          throw new Error(`apply_patch denied for path: ${resolved.rel}`);
        }
        if (isConfigManagedPath(resolved.rel)) {
          throw new Error(
            "apply_patch on config files is not allowed; use write/edit with confirmation for validated config changes",
          );
        }
      }

      const result = await applyPatch(patchInput, { cwd: workspaceDir });
      return jsonResult({ summary: result.summary, text: result.text });
    },
  };
}

export function createCallThroughShadowTool(params: {
  name: string;
  ctx: SaintToolContext;
  original: AnyAgentTool | null | undefined;
  precheck?: (tier: ResolvedTier, args: Record<string, unknown>) => Promise<void> | void;
  postprocess?: (
    tier: ResolvedTier,
    result: ToolExecutionResult,
    args: Record<string, unknown>,
  ) => Promise<ToolExecutionResult> | ToolExecutionResult;
}): AnyAgentTool {
  return {
    name: params.name,
    label: params.original?.label ?? params.name,
    description: params.original?.description ?? `${params.name} shadow`,
    parameters: params.original?.parameters ?? Type.Object({}, { additionalProperties: true }),
    execute: async (toolCallId, rawArgs, signal, onUpdate) => {
      if (!params.original?.execute) {
        throw new Error(`${params.name} unavailable`);
      }
      const args = (rawArgs as Record<string, unknown>) ?? {};
      const tier = await resolveTierForToolContext(params.ctx);
      await params.precheck?.(tier, args);
      const result = await params.original.execute(toolCallId, rawArgs, signal, onUpdate);
      if (!params.postprocess) {
        return result;
      }
      return await params.postprocess(tier, result, args);
    },
  };
}
