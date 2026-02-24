/**
 * Config IPC Handlers — exposes config read/write/validate over IPC.
 *
 * All write operations require an ELEVATED session (re-auth).
 * Read operations require any valid session.
 */

import { ipcMain } from "electron";
import { ConfigStore } from "./config-store.js";
import type { SessionManager } from "../auth/session-manager.js";
import { hasPermission } from "../auth/rbac.js";

export function registerConfigIpcHandlers(sessions: SessionManager): void {
  const store = new ConfigStore();

  // ─── Read ────────────────────────────────────────────────────────────

  ipcMain.handle("occc:config:read", async (_event, token: string) => {
    const session = sessions.resolve(token);
    if (!session || !hasPermission(session.role, "config:read")) {
      throw new Error("Unauthorized");
    }
    return store.read();
  });

  ipcMain.handle("occc:config:path", async (_event, token: string) => {
    const session = sessions.resolve(token);
    if (!session) {throw new Error("Unauthorized");}
    return store.getConfigPath();
  });

  // ─── Write (requires elevation) ──────────────────────────────────────

  ipcMain.handle(
    "occc:config:write",
    async (_event, token: string, config: Record<string, unknown>, expectedChecksum?: string) => {
      const session = sessions.resolve(token);
      if (!session || !hasPermission(session.role, "config:write")) {
        throw new Error("Unauthorized");
      }
      if (!session.elevated) {
        throw new Error("Elevation required to write configuration");
      }
      return store.write(config, expectedChecksum);
    },
  );

  ipcMain.handle(
    "occc:config:patch",
    async (_event, token: string, patch: Record<string, unknown>, expectedChecksum?: string) => {
      const session = sessions.resolve(token);
      if (!session || !hasPermission(session.role, "config:write")) {
        throw new Error("Unauthorized");
      }
      if (!session.elevated) {
        throw new Error("Elevation required to write configuration");
      }
      return store.patch(patch, expectedChecksum);
    },
  );

  // ─── Validate ────────────────────────────────────────────────────────

  ipcMain.handle(
    "occc:config:validate",
    async (_event, token: string, config: Record<string, unknown>) => {
      const session = sessions.resolve(token);
      if (!session || !hasPermission(session.role, "config:read")) {
        throw new Error("Unauthorized");
      }

      // Dynamically import the Zod schema from the main OpenClaw package.
      // Path from apps/command-center/src/main/config/ → repo-root/src/config/
      // In production the built dist will be at a known path; in dev we use the source.
      try {
        // Try the monorepo source path first (dev mode)
        const schemaPath = new URL("../../../../../../src/config/zod-schema.js", import.meta.url);
        const { OpenClawSchema } = await import(schemaPath.pathname);
        const result = OpenClawSchema.safeParse(config);
        if (result.success) {
          return { valid: true, errors: [] };
        }
        const errors = (result.error.issues as { path: (string | number)[]; message: string }[])
          .map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          }));
        return { valid: false, errors };
      } catch {
        // Schema import not available — skip validation
        return { valid: true, errors: [], note: "Schema validation unavailable in this environment" };
      }
    },
  );
}
