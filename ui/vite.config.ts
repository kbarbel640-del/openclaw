import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));

function readJsonVersion(file: string): string | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { version?: unknown };
    const rawVersion = parsed.version;
    if (typeof rawVersion !== "string" && typeof rawVersion !== "number") {
      return null;
    }
    const version = `${rawVersion}`.trim();
    return version || null;
  } catch {
    return null;
  }
}

function resolveControlUiClientVersion(): string {
  return (
    readJsonVersion(path.resolve(here, "../build-info.json")) ??
    readJsonVersion(path.resolve(here, "../package.json")) ??
    "dev"
  );
}

function normalizeBase(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "/";
  }
  if (trimmed === "./") {
    return "./";
  }
  if (trimmed.endsWith("/")) {
    return trimmed;
  }
  return `${trimmed}/`;
}

export default defineConfig(() => {
  const envBase = process.env.OPENCLAW_CONTROL_UI_BASE_PATH?.trim();
  const base = envBase ? normalizeBase(envBase) : "./";
  const clientVersion = resolveControlUiClientVersion();
  return {
    base,
    define: {
      __OPENCLAW_CONTROL_UI_VERSION__: JSON.stringify(clientVersion),
    },
    publicDir: path.resolve(here, "public"),
    optimizeDeps: {
      include: ["lit/directives/repeat.js"],
    },
    build: {
      outDir: path.resolve(here, "../dist/control-ui"),
      emptyOutDir: true,
      sourcemap: true,
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
    },
  };
});
