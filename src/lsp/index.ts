/**
 * LSP Auto-Detection & Integration
 *
 * Reactive LSP integration that automatically detects languages from file
 * extensions, starts LSP servers, and feeds diagnostics back to the agent.
 *
 * @module lsp
 */

export { detectLanguage, isLspSupported, getSupportedExtensions } from "./language-detection.js";
export { findProjectRoot, buildLspInstanceKey } from "./project-root.js";
export { LspClient, diagnosticSeverityLabel, type LspDiagnostic } from "./lsp-client.js";
export {
  getLspManager,
  resetLspManager,
  type FormattedDiagnostic,
  type LspManagerImpl,
} from "./lsp-manager.js";
export {
  createLspTools,
  createLspDiagnosticsTool,
  createLspHoverTool,
  createLspDefinitionTool,
  createLspReferencesTool,
  createLspStatusTool,
} from "./lsp-tools.js";
export { wrapToolWithLspDiagnostics, isFileWriteTool } from "./file-change-hook.js";
