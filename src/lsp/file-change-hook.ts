/**
 * File change hook for reactive LSP diagnostics.
 *
 * Intercepts write/edit tool executions and feeds file changes to the LSP manager.
 * Appends diagnostics information to the tool result so the agent sees errors
 * and warnings immediately after file operations.
 */

import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { AnyAgentTool } from "../agents/tools/common.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { isLspSupported } from "./language-detection.js";
import { getLspManager, type FormattedDiagnostic } from "./lsp-manager.js";

const log = createSubsystemLogger("lsp/file-hook");

function appendDiagnosticsToResult(
  result: AgentToolResult<unknown>,
  diagnostics: FormattedDiagnostic[],
): AgentToolResult<unknown> {
  if (diagnostics.length === 0) {
    return result;
  }

  const errors = diagnostics.filter((d) => d.severity === "Error");
  const warnings = diagnostics.filter((d) => d.severity === "Warning");

  const lines: string[] = [];
  lines.push("");
  lines.push("--- LSP Diagnostics ---");
  lines.push(
    `${errors.length} error(s), ${warnings.length} warning(s), ${diagnostics.length - errors.length - warnings.length} other(s)`,
  );

  for (const diag of diagnostics) {
    const source = diag.source ? ` [${diag.source}]` : "";
    const code = diag.code ? ` (${diag.code})` : "";
    lines.push(
      `  ${diag.severity} L${diag.line}:${diag.character}${source}${code}: ${diag.message}`,
    );
  }

  const diagnosticText = lines.join("\n");
  const content = Array.isArray(result.content) ? [...result.content] : [];

  // Append to existing text block or add new one
  const lastText = content.findLast(
    (block): block is { type: "text"; text: string } =>
      !!block && typeof block === "object" && (block as { type?: string }).type === "text",
  );

  if (lastText) {
    const idx = content.lastIndexOf(lastText);
    content[idx] = { type: "text", text: lastText.text + diagnosticText };
  } else {
    content.push({ type: "text", text: diagnosticText });
  }

  return { ...result, content };
}

function extractFilePath(params: unknown): string | undefined {
  if (!params || typeof params !== "object") {
    return undefined;
  }
  const record = params as Record<string, unknown>;
  // Handle both path and file_path (Claude Code compatibility)
  const rawPath = record.path ?? record.file_path;
  return typeof rawPath === "string" ? rawPath.trim() : undefined;
}

function extractFileContent(params: unknown): string | undefined {
  if (!params || typeof params !== "object") {
    return undefined;
  }
  const record = params as Record<string, unknown>;
  const content = record.content ?? record.text;
  return typeof content === "string" ? content : undefined;
}

/**
 * Wrap a write or edit tool to automatically collect LSP diagnostics after execution.
 */
export function wrapToolWithLspDiagnostics(tool: AnyAgentTool): AnyAgentTool {
  const originalExecute = tool.execute;
  if (!originalExecute) {
    return tool;
  }

  return {
    ...tool,
    execute: async (toolCallId, params, signal, onUpdate) => {
      // Execute the original tool first
      const result = await originalExecute(toolCallId, params, signal, onUpdate);

      // Extract file path from params
      const filePath = extractFilePath(params);
      if (!filePath || !isLspSupported(filePath)) {
        return result;
      }

      // Collect diagnostics asynchronously (don't block on failure)
      try {
        const content = extractFileContent(params);
        const manager = getLspManager();
        const diagnostics = await manager.handleFileChange(filePath, content);
        return appendDiagnosticsToResult(result, diagnostics);
      } catch (err) {
        log.debug(`LSP diagnostics collection failed for ${filePath}: ${String(err)}`);
        return result;
      }
    },
  };
}

/**
 * Check if a tool name is a file-writing tool that should trigger LSP diagnostics.
 */
export function isFileWriteTool(toolName: string): boolean {
  const name = toolName.toLowerCase();
  return name === "write" || name === "edit" || name === "apply_patch";
}
