/**
 * LSP agent tools: diagnostics, hover, definition, references.
 *
 * These tools are exposed to the agent to query LSP servers for
 * code intelligence information.
 */

import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../agents/tools/common.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { getLspManager, type FormattedDiagnostic } from "./lsp-manager.js";

const log = createSubsystemLogger("lsp/tools");

function textResult(text: string): AgentToolResult<unknown> {
  return { content: [{ type: "text", text }], details: {} };
}

function formatDiagnosticsText(diagnostics: FormattedDiagnostic[]): string {
  if (diagnostics.length === 0) {
    return "No diagnostics found.";
  }

  const errors = diagnostics.filter((d) => d.severity === "Error");
  const warnings = diagnostics.filter((d) => d.severity === "Warning");
  const others = diagnostics.filter((d) => d.severity !== "Error" && d.severity !== "Warning");

  const lines: string[] = [];
  lines.push(
    `Found ${diagnostics.length} diagnostic(s): ${errors.length} error(s), ${warnings.length} warning(s), ${others.length} other(s).`,
  );
  lines.push("");

  for (const diag of diagnostics) {
    const loc = `${diag.file}:${diag.line}:${diag.character}`;
    const source = diag.source ? ` [${diag.source}]` : "";
    const code = diag.code ? ` (${diag.code})` : "";
    lines.push(`${diag.severity}: ${loc}${source}${code}`);
    lines.push(`  ${diag.message}`);
  }

  return lines.join("\n");
}

/**
 * Tool: lsp_diagnostics — Get diagnostics (errors, warnings) for a file.
 */
export function createLspDiagnosticsTool(): AnyAgentTool {
  return {
    label: "LSP Diagnostics",
    name: "lsp_diagnostics",
    description:
      "Get LSP diagnostics (errors, warnings, type issues) for a file. " +
      "Automatically detects the language and starts the LSP server if needed. " +
      "Useful for checking code health after writing or editing files.",
    parameters: Type.Object({
      path: Type.String({
        description: "Path to the file to check diagnostics for",
      }),
    }),
    execute: async (_toolCallId, args) => {
      const params = args as { path: string };
      const filePath = params.path?.trim();
      if (!filePath) {
        return textResult("Error: path is required");
      }

      try {
        const manager = getLspManager();
        const diagnostics = await manager.handleFileChange(filePath);
        return textResult(formatDiagnosticsText(diagnostics));
      } catch (err) {
        log.debug(`LSP diagnostics failed: ${String(err)}`);
        return textResult(`LSP diagnostics unavailable: ${String(err)}`);
      }
    },
  };
}

/**
 * Tool: lsp_hover — Get hover information (type info, docs) for a position.
 */
export function createLspHoverTool(): AnyAgentTool {
  return {
    label: "LSP Hover",
    name: "lsp_hover",
    description:
      "Get hover information (type signatures, documentation) for a symbol at a given position in a file. " +
      "Line and character are 1-based.",
    parameters: Type.Object({
      path: Type.String({ description: "Path to the file" }),
      line: Type.Number({ description: "Line number (1-based)" }),
      character: Type.Number({ description: "Character offset (1-based)" }),
    }),
    execute: async (_toolCallId, args) => {
      const params = args as { path: string; line: number; character: number };
      if (!params.path?.trim()) {
        return textResult("Error: path is required");
      }

      try {
        const manager = getLspManager();
        // Convert 1-based to 0-based for LSP
        const result = await manager.hover(params.path, params.line - 1, params.character - 1);

        if (!result) {
          return textResult("No hover information available at this position.");
        }

        return textResult(result);
      } catch (err) {
        log.debug(`LSP hover failed: ${String(err)}`);
        return textResult(`LSP hover unavailable: ${String(err)}`);
      }
    },
  };
}

/**
 * Tool: lsp_definition — Go to definition for a symbol.
 */
export function createLspDefinitionTool(): AnyAgentTool {
  return {
    label: "LSP Definition",
    name: "lsp_definition",
    description:
      "Go to definition: find where a symbol is defined. " +
      "Line and character are 1-based. Returns file path and position of the definition.",
    parameters: Type.Object({
      path: Type.String({ description: "Path to the file" }),
      line: Type.Number({ description: "Line number (1-based)" }),
      character: Type.Number({ description: "Character offset (1-based)" }),
    }),
    execute: async (_toolCallId, args) => {
      const params = args as { path: string; line: number; character: number };
      if (!params.path?.trim()) {
        return textResult("Error: path is required");
      }

      try {
        const manager = getLspManager();
        const locations = await manager.definition(
          params.path,
          params.line - 1,
          params.character - 1,
        );

        if (locations.length === 0) {
          return textResult("No definition found at this position.");
        }

        const lines = ["Definition location(s):"];
        for (const loc of locations) {
          lines.push(`  ${loc.file}:${loc.line}:${loc.character}`);
        }
        return textResult(lines.join("\n"));
      } catch (err) {
        log.debug(`LSP definition failed: ${String(err)}`);
        return textResult(`LSP definition unavailable: ${String(err)}`);
      }
    },
  };
}

/**
 * Tool: lsp_references — Find all references to a symbol.
 */
export function createLspReferencesTool(): AnyAgentTool {
  return {
    label: "LSP References",
    name: "lsp_references",
    description:
      "Find all references to a symbol at a given position. " +
      "Line and character are 1-based. Returns all locations where the symbol is used.",
    parameters: Type.Object({
      path: Type.String({ description: "Path to the file" }),
      line: Type.Number({ description: "Line number (1-based)" }),
      character: Type.Number({ description: "Character offset (1-based)" }),
    }),
    execute: async (_toolCallId, args) => {
      const params = args as { path: string; line: number; character: number };
      if (!params.path?.trim()) {
        return textResult("Error: path is required");
      }

      try {
        const manager = getLspManager();
        const locations = await manager.references(
          params.path,
          params.line - 1,
          params.character - 1,
        );

        if (locations.length === 0) {
          return textResult("No references found at this position.");
        }

        const lines = [`Found ${locations.length} reference(s):`];
        for (const loc of locations) {
          lines.push(`  ${loc.file}:${loc.line}:${loc.character}`);
        }
        return textResult(lines.join("\n"));
      } catch (err) {
        log.debug(`LSP references failed: ${String(err)}`);
        return textResult(`LSP references unavailable: ${String(err)}`);
      }
    },
  };
}

/**
 * Tool: lsp_status — Show status of all running LSP servers.
 */
export function createLspStatusTool(): AnyAgentTool {
  return {
    label: "LSP Status",
    name: "lsp_status",
    description:
      "Show the status of all running LSP server instances, including project roots, " +
      "server names, and number of tracked files.",
    parameters: Type.Object({}),
    execute: async () => {
      const manager = getLspManager();
      const status = manager.getStatus();

      if (status.length === 0) {
        return textResult("No LSP servers running.");
      }

      const lines = [`${status.length} LSP server(s) running:`];
      for (const s of status) {
        const state = s.alive ? "alive" : "dead";
        lines.push(`  ${s.server} at ${s.projectRoot} — ${s.openFiles} file(s) open [${state}]`);
      }
      return textResult(lines.join("\n"));
    },
  };
}

/**
 * Create all LSP tools.
 */
export function createLspTools(): AnyAgentTool[] {
  return [
    createLspDiagnosticsTool(),
    createLspHoverTool(),
    createLspDefinitionTool(),
    createLspReferencesTool(),
    createLspStatusTool(),
  ];
}
