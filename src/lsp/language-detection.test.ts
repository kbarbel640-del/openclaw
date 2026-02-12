import { describe, expect, it } from "vitest";
import {
  detectLanguage,
  getSupportedExtensions,
  getUniqueServerCommands,
  isLspSupported,
} from "./language-detection.js";

describe("language-detection", () => {
  describe("detectLanguage", () => {
    it("detects TypeScript files", () => {
      const config = detectLanguage("src/index.ts");
      expect(config).toBeDefined();
      expect(config!.languageId).toBe("typescript");
      expect(config!.serverCommand).toBe("typescript-language-server");
    });

    it("detects TSX files", () => {
      const config = detectLanguage("components/App.tsx");
      expect(config).toBeDefined();
      expect(config!.languageId).toBe("typescriptreact");
    });

    it("detects JavaScript files", () => {
      const config = detectLanguage("lib/utils.js");
      expect(config).toBeDefined();
      expect(config!.languageId).toBe("javascript");
    });

    it("detects JSX files", () => {
      const config = detectLanguage("components/Button.jsx");
      expect(config).toBeDefined();
      expect(config!.languageId).toBe("javascriptreact");
    });

    it("detects ESM files (.mjs)", () => {
      const config = detectLanguage("scripts/build.mjs");
      expect(config).toBeDefined();
      expect(config!.languageId).toBe("javascript");
    });

    it("detects CJS files (.cjs)", () => {
      const config = detectLanguage("config/webpack.cjs");
      expect(config).toBeDefined();
      expect(config!.languageId).toBe("javascript");
    });

    it("detects Python files", () => {
      const config = detectLanguage("main.py");
      expect(config).toBeDefined();
      expect(config!.languageId).toBe("python");
      expect(config!.serverCommand).toBe("pyright-langserver");
    });

    it("detects Go files", () => {
      const config = detectLanguage("main.go");
      expect(config).toBeDefined();
      expect(config!.languageId).toBe("go");
      expect(config!.serverCommand).toBe("gopls");
    });

    it("detects Rust files", () => {
      const config = detectLanguage("src/main.rs");
      expect(config).toBeDefined();
      expect(config!.languageId).toBe("rust");
      expect(config!.serverCommand).toBe("rust-analyzer");
    });

    it("returns undefined for unsupported extensions", () => {
      expect(detectLanguage("README.md")).toBeUndefined();
      expect(detectLanguage("style.css")).toBeUndefined();
      expect(detectLanguage("data.json")).toBeUndefined();
      expect(detectLanguage("Makefile")).toBeUndefined();
    });

    it("handles uppercase extensions via toLowerCase", () => {
      // path.extname preserves case but we normalize with toLowerCase
      const config = detectLanguage("main.TS");
      // Since we call .toLowerCase(), .TS becomes .ts and matches
      // This ensures case-insensitive file extension handling
      expect(config).toBeDefined();
      expect(config!.languageId).toBe("typescript");
    });

    it("provides correct root config files for each language", () => {
      const ts = detectLanguage("foo.ts")!;
      expect(ts.rootConfigFiles).toContain("tsconfig.json");
      expect(ts.rootConfigFiles).toContain("package.json");

      const py = detectLanguage("foo.py")!;
      expect(py.rootConfigFiles).toContain("pyproject.toml");

      const go = detectLanguage("foo.go")!;
      expect(go.rootConfigFiles).toContain("go.mod");

      const rs = detectLanguage("foo.rs")!;
      expect(rs.rootConfigFiles).toContain("Cargo.toml");
    });
  });

  describe("isLspSupported", () => {
    it("returns true for supported files", () => {
      expect(isLspSupported("foo.ts")).toBe(true);
      expect(isLspSupported("foo.py")).toBe(true);
      expect(isLspSupported("foo.go")).toBe(true);
      expect(isLspSupported("foo.rs")).toBe(true);
    });

    it("returns false for unsupported files", () => {
      expect(isLspSupported("foo.md")).toBe(false);
      expect(isLspSupported("foo.html")).toBe(false);
    });
  });

  describe("getSupportedExtensions", () => {
    it("includes all supported extensions", () => {
      const extensions = getSupportedExtensions();
      expect(extensions).toContain(".ts");
      expect(extensions).toContain(".tsx");
      expect(extensions).toContain(".js");
      expect(extensions).toContain(".jsx");
      expect(extensions).toContain(".mjs");
      expect(extensions).toContain(".cjs");
      expect(extensions).toContain(".py");
      expect(extensions).toContain(".go");
      expect(extensions).toContain(".rs");
    });
  });

  describe("getUniqueServerCommands", () => {
    it("returns deduplicated server commands", () => {
      const commands = getUniqueServerCommands();
      expect(commands).toContain("typescript-language-server");
      expect(commands).toContain("pyright-langserver");
      expect(commands).toContain("gopls");
      expect(commands).toContain("rust-analyzer");
      // typescript-language-server should appear only once
      expect(commands.filter((c) => c === "typescript-language-server")).toHaveLength(1);
    });
  });
});
