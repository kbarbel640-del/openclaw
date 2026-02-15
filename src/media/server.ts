import type { Server } from "node:http";
import { node } from "@elysiajs/node";
import { Elysia } from "elysia";
import fs from "node:fs/promises";
import { danger } from "../globals.js";
import { SafeOpenError, openFileWithinRoot } from "../infra/fs-safe.js";
import { defaultRuntime, type RuntimeEnv } from "../runtime.js";
import { detectMime } from "./mime.js";
import { cleanOldMedia, getMediaDir, MEDIA_MAX_BYTES } from "./store.js";

const DEFAULT_TTL_MS = 2 * 60 * 1000;
const MAX_MEDIA_ID_CHARS = 200;
const MEDIA_ID_PATTERN = /^[\p{L}\p{N}._-]+$/u;
const MAX_MEDIA_BYTES = MEDIA_MAX_BYTES;

const isValidMediaId = (id: string) => {
  if (!id) {
    return false;
  }
  if (id.length > MAX_MEDIA_ID_CHARS) {
    return false;
  }
  if (id === "." || id === "..") {
    return false;
  }
  return MEDIA_ID_PATTERN.test(id);
};

export function attachMediaRoutes(
  app: Elysia,
  ttlMs = DEFAULT_TTL_MS,
  _runtime: RuntimeEnv = defaultRuntime,
) {
  const mediaDir = getMediaDir();

  app.get("/media/:id", async ({ params, set, store }) => {
    const id = params.id;
    if (!isValidMediaId(id)) {
      set.status = 400;
      return "invalid path";
    }
    try {
      const { handle, realPath, stat } = await openFileWithinRoot({
        rootDir: mediaDir,
        relativePath: id,
      });
      if (stat.size > MAX_MEDIA_BYTES) {
        await handle.close().catch(() => {});
        set.status = 413;
        return "too large";
      }
      if (Date.now() - stat.mtimeMs > ttlMs) {
        await handle.close().catch(() => {});
        await fs.rm(realPath).catch(() => {});
        set.status = 410;
        return "expired";
      }
      const data = await handle.readFile();
      await handle.close().catch(() => {});
      const mime = await detectMime({ buffer: data, filePath: realPath });
      if (mime) {
        set.headers["content-type"] = mime;
      }
      // store realPath for cleanup after response
      (store as Record<string, unknown>).realPath = realPath;
      return data;
    } catch (err) {
      if (err instanceof SafeOpenError) {
        if (err.code === "invalid-path") {
          set.status = 400;
          return "invalid path";
        }
        if (err.code === "not-found") {
          set.status = 404;
          return "not found";
        }
      }
      set.status = 404;
      return "not found";
    }
  });

  // best-effort single-use cleanup after response ends
  app.onAfterResponse(({ store }) => {
    const realPath = (store as Record<string, unknown>).realPath;
    if (typeof realPath === "string") {
      setTimeout(() => {
        fs.rm(realPath).catch(() => {});
      }, 50);
    }
  });

  // periodic cleanup
  setInterval(() => {
    void cleanOldMedia(ttlMs);
  }, ttlMs).unref();
}

export async function startMediaServer(
  port: number,
  ttlMs = DEFAULT_TTL_MS,
  runtime: RuntimeEnv = defaultRuntime,
): Promise<Server> {
  const app = new Elysia({ adapter: node() });
  attachMediaRoutes(app, ttlMs, runtime);
  return await new Promise((resolve, reject) => {
    const server = app.listen(port) as unknown as { server?: Server };
    if (server.server) {
      server.server.once("listening", () => {
        if (server.server) {
          resolve(server.server);
        }
      });
      server.server.once("error", (err) => {
        runtime.error(danger(`Media server failed: ${String(err)}`));
        reject(err);
      });
    } else {
      reject(new Error("Failed to create HTTP server"));
    }
  });
}
