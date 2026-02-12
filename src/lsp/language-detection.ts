/**
 * Language detection from file extensions and LSP server mapping.
 *
 * Maps file extensions → language IDs → LSP server commands.
 * Follows the LSP specification's language identifiers.
 */

import path from "node:path";

export type LanguageId =
  | "typescript"
  | "typescriptreact"
  | "javascript"
  | "javascriptreact"
  | "python"
  | "go"
  | "rust";

export type LspServerConfig = {
  /** LSP language identifier (sent in textDocument/didOpen) */
  languageId: LanguageId;
  /** Display name for logging */
  displayName: string;
  /** Server binary name */
  serverCommand: string;
  /** Arguments for the server binary */
  serverArgs: string[];
  /** Config files that identify a project root */
  rootConfigFiles: string[];
};

const EXTENSION_MAP: Record<string, LspServerConfig> = {
  ".ts": {
    languageId: "typescript",
    displayName: "TypeScript",
    serverCommand: "typescript-language-server",
    serverArgs: ["--stdio"],
    rootConfigFiles: ["tsconfig.json", "jsconfig.json", "package.json"],
  },
  ".tsx": {
    languageId: "typescriptreact",
    displayName: "TypeScript React",
    serverCommand: "typescript-language-server",
    serverArgs: ["--stdio"],
    rootConfigFiles: ["tsconfig.json", "jsconfig.json", "package.json"],
  },
  ".js": {
    languageId: "javascript",
    displayName: "JavaScript",
    serverCommand: "typescript-language-server",
    serverArgs: ["--stdio"],
    rootConfigFiles: ["tsconfig.json", "jsconfig.json", "package.json"],
  },
  ".jsx": {
    languageId: "javascriptreact",
    displayName: "JavaScript React",
    serverCommand: "typescript-language-server",
    serverArgs: ["--stdio"],
    rootConfigFiles: ["tsconfig.json", "jsconfig.json", "package.json"],
  },
  ".mjs": {
    languageId: "javascript",
    displayName: "JavaScript (ESM)",
    serverCommand: "typescript-language-server",
    serverArgs: ["--stdio"],
    rootConfigFiles: ["tsconfig.json", "jsconfig.json", "package.json"],
  },
  ".cjs": {
    languageId: "javascript",
    displayName: "JavaScript (CJS)",
    serverCommand: "typescript-language-server",
    serverArgs: ["--stdio"],
    rootConfigFiles: ["tsconfig.json", "jsconfig.json", "package.json"],
  },
  ".py": {
    languageId: "python",
    displayName: "Python",
    serverCommand: "pyright-langserver",
    serverArgs: ["--stdio"],
    rootConfigFiles: ["pyproject.toml", "setup.py", "setup.cfg", "requirements.txt"],
  },
  ".go": {
    languageId: "go",
    displayName: "Go",
    serverCommand: "gopls",
    serverArgs: ["serve"],
    rootConfigFiles: ["go.mod"],
  },
  ".rs": {
    languageId: "rust",
    displayName: "Rust",
    serverCommand: "rust-analyzer",
    serverArgs: [],
    rootConfigFiles: ["Cargo.toml"],
  },
};

/**
 * Detect language configuration from a file path.
 * Returns undefined for unsupported file types.
 */
export function detectLanguage(filePath: string): LspServerConfig | undefined {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_MAP[ext];
}

/**
 * Check if a file extension is supported for LSP.
 */
export function isLspSupported(filePath: string): boolean {
  return detectLanguage(filePath) !== undefined;
}

/**
 * Get all supported file extensions.
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(EXTENSION_MAP);
}

/**
 * Get all unique LSP server commands (deduped).
 */
export function getUniqueServerCommands(): string[] {
  const commands = new Set(Object.values(EXTENSION_MAP).map((config) => config.serverCommand));
  return Array.from(commands);
}
