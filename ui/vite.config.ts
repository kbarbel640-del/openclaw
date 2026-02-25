import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));

// Read the version from the root package.json so the Control UI can advertise
// the correct build version in its WebSocket connect params instead of "dev".
function resolveAppVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(path.resolve(here, "../package.json"), "utf8")) as {
      version?: string;
    };
    return pkg.version ?? "dev";
  } catch {
    return "dev";
  }
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
  const appVersion = resolveAppVersion();
  return {
    base,
    define: {
      // Injected at build time so the Control UI can report the correct version
      // in its WebSocket connect params (clientVersion) instead of "dev".
      __APP_VERSION__: JSON.stringify(appVersion),
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
