/**
 * A2UI static serving route — Elysia plugin.
 *
 * GET /__openclaw__/a2ui/* — Serves the A2UI (canvas host UI) static assets.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Elysia } from "elysia";
import { CANVAS_WS_PATH } from "../../canvas-host/a2ui.js";
import { detectMime } from "../../media/mime.js";

const A2UI_PATH = "/__openclaw__/a2ui";

let cachedA2uiRootReal: string | null | undefined;
let resolvingA2uiRoot: Promise<string | null> | null = null;

async function resolveA2uiRoot(): Promise<string | null> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "../../canvas-host/a2ui"),
    path.resolve(here, "../../../src/canvas-host/a2ui"),
    path.resolve(process.cwd(), "src/canvas-host/a2ui"),
    path.resolve(process.cwd(), "dist/canvas-host/a2ui"),
  ];
  if (process.execPath) {
    candidates.unshift(path.resolve(path.dirname(process.execPath), "a2ui"));
  }

  for (const dir of candidates) {
    try {
      const indexPath = path.join(dir, "index.html");
      const bundlePath = path.join(dir, "a2ui.bundle.js");
      await fs.stat(indexPath);
      await fs.stat(bundlePath);
      return dir;
    } catch {
      // try next
    }
  }
  return null;
}

async function resolveA2uiRootReal(): Promise<string | null> {
  if (cachedA2uiRootReal !== undefined) {
    return cachedA2uiRootReal;
  }
  if (!resolvingA2uiRoot) {
    resolvingA2uiRoot = (async () => {
      const root = await resolveA2uiRoot();
      cachedA2uiRootReal = root ? await fs.realpath(root) : null;
      return cachedA2uiRootReal;
    })();
  }
  return resolvingA2uiRoot;
}

function normalizeUrlPath(rawPath: string): string {
  const decoded = decodeURIComponent(rawPath || "/");
  const normalized = path.posix.normalize(decoded);
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

async function resolveA2uiFilePath(rootReal: string, urlPath: string): Promise<string | null> {
  const normalized = normalizeUrlPath(urlPath);
  const rel = normalized.replace(/^\/+/, "");
  if (rel.split("/").some((p) => p === "..")) {
    return null;
  }

  let candidate = path.join(rootReal, rel);
  if (normalized.endsWith("/")) {
    candidate = path.join(candidate, "index.html");
  }

  try {
    const st = await fs.stat(candidate);
    if (st.isDirectory()) {
      candidate = path.join(candidate, "index.html");
    }
  } catch {
    // ignore
  }

  const rootPrefix = rootReal.endsWith(path.sep) ? rootReal : `${rootReal}${path.sep}`;
  try {
    const lstat = await fs.lstat(candidate);
    if (lstat.isSymbolicLink()) {
      return null;
    }
    const real = await fs.realpath(candidate);
    if (!real.startsWith(rootPrefix)) {
      return null;
    }
    return real;
  } catch {
    return null;
  }
}

function injectCanvasLiveReload(html: string): string {
  const snippet = `
<script>
(() => {
  const handlerNames = ["openclawCanvasA2UIAction"];
  function postToNode(payload) {
    try {
      const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
      for (const name of handlerNames) {
        const iosHandler = globalThis.webkit?.messageHandlers?.[name];
        if (iosHandler && typeof iosHandler.postMessage === "function") {
          iosHandler.postMessage(raw);
          return true;
        }
        const androidHandler = globalThis[name];
        if (androidHandler && typeof androidHandler.postMessage === "function") {
          androidHandler.postMessage(raw);
          return true;
        }
      }
    } catch {}
    return false;
  }
  function sendUserAction(userAction) {
    const id =
      (userAction && typeof userAction.id === "string" && userAction.id.trim()) ||
      (globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
    const action = { ...userAction, id };
    return postToNode({ userAction: action });
  }
  globalThis.OpenClaw = globalThis.OpenClaw ?? {};
  globalThis.OpenClaw.postMessage = postToNode;
  globalThis.OpenClaw.sendUserAction = sendUserAction;
  globalThis.openclawPostMessage = postToNode;
  globalThis.openclawSendUserAction = sendUserAction;

  try {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(proto + "://" + location.host + ${JSON.stringify(CANVAS_WS_PATH)});
    ws.onmessage = (ev) => {
      if (String(ev.data || "") === "reload") location.reload();
    };
  } catch {}
})();
</script>`.trim();

  const idx = html.toLowerCase().lastIndexOf("</body>");
  if (idx >= 0) {
    return `${html.slice(0, idx)}\n${snippet}\n${html.slice(idx)}`;
  }
  return `${html}\n${snippet}\n`;
}

export function a2uiRoutes() {
  return new Elysia({ name: "a2ui-routes" }).all(`${A2UI_PATH}/*`, async ({ request, set }) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      set.status = 405;
      set.headers["content-type"] = "text/plain; charset=utf-8";
      return "Method Not Allowed";
    }

    const a2uiRootReal = await resolveA2uiRootReal();
    if (!a2uiRootReal) {
      set.status = 503;
      set.headers["content-type"] = "text/plain; charset=utf-8";
      return "A2UI assets not found";
    }

    const url = new URL(request.url);
    const rel = url.pathname.slice(A2UI_PATH.length);
    const filePath = await resolveA2uiFilePath(a2uiRootReal, rel || "/");
    if (!filePath) {
      set.status = 404;
      set.headers["content-type"] = "text/plain; charset=utf-8";
      return "not found";
    }

    const lower = filePath.toLowerCase();
    const mime =
      lower.endsWith(".html") || lower.endsWith(".htm")
        ? "text/html"
        : ((await detectMime({ filePath })) ?? "application/octet-stream");
    set.headers["cache-control"] = "no-store";

    if (mime === "text/html") {
      const html = await fs.readFile(filePath, "utf8");
      set.headers["content-type"] = "text/html; charset=utf-8";
      return injectCanvasLiveReload(html);
    }

    set.headers["content-type"] = mime;
    return await fs.readFile(filePath);
  });
}
