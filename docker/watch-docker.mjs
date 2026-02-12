#!/usr/bin/env node
/**
 * Watch Dockerfile and docker-compose.yml; on change run:
 *   docker compose down openclaw-gateway && docker compose up -d --build --force-recreate openclaw-gateway
 * Intended to be run as a long-lived daemon (e.g. under PM2).
 */
import chokidar from "chokidar";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEBOUNCE_MS = 3000;
const CWD = process.cwd();
const BUILD_PENDING_FILE = path.join(CWD, ".watch-docker-build-pending");
const WATCH_FILES = ["Dockerfile", "docker-compose.yml", "ui", ".env"];
const HEALTHCHECK_URL = "https://openclaw-gateway.tail5587.ts.net/";
const HEALTHCHECK_TIMEOUT_MS = 30_000;
const HEALTHCHECK_INTERVAL_MS = 60_000;

let debounceTimer = null;
let healthTimer = null;
let running = false;
let recoveringByHealthcheck = false;
/** 目前正在跑的 compose 子行程，供執行中觸發時 kill */
let composeChild = null;
/** 當前 run 的 id，被 kill 後啟動新 run 時遞增，用於忽略舊 run 的 .then() */
let currentRunId = 0;

function removeBuildPending() {
  try {
    fs.unlinkSync(BUILD_PENDING_FILE);
  } catch {
    /* 忽略 */
  }
}

function run(cmd, args, opts = {}) {
  const { childRef = {}, capture, captureStderr, captureBoth, ...spawnOpts } = opts;
  const pipeBoth = capture || captureBoth;
  const stdio = pipeBoth ? "pipe" : captureStderr ? ["inherit", "inherit", "pipe"] : "inherit";
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: CWD, stdio, ...spawnOpts });
    childRef.current = child;
    let stdout = "";
    let stderr = "";
    if (pipeBoth && child.stdout) {
      child.stdout.on("data", (d) => {
        stdout += d.toString();
        process.stdout.write(d);
      });
    }
    if ((capture || captureStderr || pipeBoth) && child.stderr) {
      child.stderr.on("data", (d) => {
        stderr += d.toString();
        if (pipeBoth) {
          process.stderr.write(d);
        }
      });
    }
    child.on("close", (code, signal) => resolve({ code, signal, stderr: stderr + stdout }));
    child.on("error", () => resolve({ code: 1, signal: null, stderr: "" }));
  });
}

async function runJustUpRecovery() {
  if (recoveringByHealthcheck || running) {
    return;
  }
  recoveringByHealthcheck = true;
  const ts = new Date().toISOString();
  console.log(`[${ts}] Healthcheck failed >30s. Running recovery: just up`);
  const result = await run("bash", ["-lc", "just up"], {
    env: { ...process.env, BUILDKIT_PROGRESS: "plain" },
    captureBoth: true,
  });
  const ts2 = new Date().toISOString();
  if (result.code === 0) {
    removeBuildPending();
    console.log(`[${ts2}] Recovery (just up) finished successfully.`);
  } else {
    console.error(`[${ts2}] Recovery (just up) failed with code=${result.code}.`);
  }
  recoveringByHealthcheck = false;
}

async function probeGatewayHealth() {
  if (running || recoveringByHealthcheck) {
    return;
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), HEALTHCHECK_TIMEOUT_MS);
  try {
    const res = await fetch(HEALTHCHECK_URL, {
      method: "GET",
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (!res.ok) {
      console.warn(
        `[${new Date().toISOString()}] Healthcheck non-OK status ${res.status} from ${HEALTHCHECK_URL}`,
      );
      await runJustUpRecovery();
    }
  } catch (err) {
    console.warn(
      `[${new Date().toISOString()}] Healthcheck failed for ${HEALTHCHECK_URL}: ${String(err)}`,
    );
    await runJustUpRecovery();
  } finally {
    clearTimeout(t);
  }
}

function runCompose(retrying = false) {
  if (running && !retrying) {
    console.log(`[${new Date().toISOString()}] Rebuild in progress, killing and starting latest…`);
    if (composeChild?.kill) {
      composeChild.kill("SIGTERM");
    }
    composeChild = null;
    setTimeout(() => runCompose(), 400);
    return;
  }
  running = true;
  try {
    fs.writeFileSync(BUILD_PENDING_FILE, "", "utf8");
  } catch {
    /* 忽略寫入失敗 */
  }
  const myRunId = ++currentRunId;
  const childRef = {};
  const ts = new Date().toISOString();
  console.log(
    `[${ts}] Triggering: docker compose down openclaw-gateway && docker compose up -d --build --force-recreate openclaw-gateway`,
  );
  void run("docker", ["compose", "down", "openclaw-gateway"])
    .then(({ code: _code }) => {
      if (myRunId !== currentRunId) {
        running = false;
        return;
      }
      const upPromise = run(
        "docker",
        ["compose", "up", "-d", "--build", "--force-recreate", "openclaw-gateway"],
        {
          env: { ...process.env, BUILDKIT_PROGRESS: "plain" },
          childRef,
          captureBoth: true, // BUILDKIT_PROGRESS=plain 時衝突錯誤在 stdout，需 capture 兩者才能偵測
        },
      );
      composeChild = childRef.current;
      return upPromise;
    })
    .then((result) => {
      composeChild = null;
      if (!result) {
        return;
      }
      const { code, signal, stderr } = result;
      if (myRunId !== currentRunId) {
        running = false;
        return;
      }
      running = false;
      const ts2 = new Date().toISOString();
      if (signal === "SIGTERM") {
        return;
      }
      if (code === 0) {
        removeBuildPending();
        console.log(`[${ts2}] Rebuild finished successfully.`);
        return;
      }
      const conflictMatch =
        !retrying && stderr.match(/container name "(\/[^"]+)" is already in use by container/);
      if (conflictMatch) {
        const name = conflictMatch[1].replace(/^\//, "");
        console.log(`[${ts2}] Removing conflicting container "${name}" and retrying…`);
        void run("docker", ["rm", "-f", name]).then(() => runCompose(true));
        return;
      }
      removeBuildPending();
      if (stderr) {
        console.error(stderr);
      }
      console.error(`[${ts2}] Rebuild exited with code=${code}. Daemon keeps watching.`);
    });
}

const IGNORED_PATH_SEGMENTS = ["node_modules", ".vite-temp", ".cache", "dist"];
/** 容器 log 寫入 logs/ 的子行程，與 watch 同進退 */
let logsTailChild = null;

function startLogsTail() {
  if (logsTailChild) {
    return;
  }
  const scriptPath = path.join(CWD, "docker", "gateway-logs-tail.mjs");
  if (!fs.existsSync(scriptPath)) {
    return;
  }
  logsTailChild = spawn(process.execPath, [scriptPath], {
    cwd: CWD,
    stdio: ["ignore", "ignore", "inherit"],
  });
  logsTailChild.on("close", (code, signal) => {
    logsTailChild = null;
    if (code != null && code !== 0 && signal !== "SIGTERM") {
      console.warn(
        `[${new Date().toISOString()}] logs-tail exited code=${code}, restarting in 5s…`,
      );
      setTimeout(startLogsTail, 5000);
    }
  });
}

function shouldIgnore(path) {
  return IGNORED_PATH_SEGMENTS.some((seg) => path.includes(`/${seg}/`) || path.includes(`/${seg}`));
}

function scheduleRebuild() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    runCompose();
  }, DEBOUNCE_MS);
}

const watcher = chokidar.watch(WATCH_FILES, {
  cwd: CWD,
  ignoreInitial: true,
  ignored: ["**/node_modules/**", "**/.vite-temp/**", "**/.cache/**", "**/dist/**"],
});

watcher.on("change", (path) => {
  if (shouldIgnore(path)) {
    return;
  }
  console.log(`[${new Date().toISOString()}] ${path} changed.`);
  scheduleRebuild();
});

watcher.on("add", (path) => {
  if (shouldIgnore(path)) {
    return;
  }
  const matches = WATCH_FILES.includes(path) || WATCH_FILES.some((w) => path.startsWith(w + "/"));
  if (matches) {
    console.log(`[${new Date().toISOString()}] ${path} added.`);
    scheduleRebuild();
  }
});

watcher.on("error", (err) => {
  console.error(`[${new Date().toISOString()}] Watcher error:`, err.message);
});

watcher.on("ready", () => {
  console.log(
    `[${new Date().toISOString()}] Watching ${WATCH_FILES.join(", ")}. Edit to trigger rebuild.`,
  );
  console.log(
    `[${new Date().toISOString()}] Healthcheck enabled: ${HEALTHCHECK_URL} (timeout ${HEALTHCHECK_TIMEOUT_MS}ms, interval ${HEALTHCHECK_INTERVAL_MS}ms)`,
  );
  startLogsTail();
  void probeGatewayHealth();
  healthTimer = setInterval(() => {
    void probeGatewayHealth();
  }, HEALTHCHECK_INTERVAL_MS);
  if (fs.existsSync(BUILD_PENDING_FILE)) {
    console.log(`[${new Date().toISOString()}] Resuming interrupted build (watch restarted).`);
    runCompose();
  }
});

function shutdown() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  if (healthTimer) {
    clearInterval(healthTimer);
  }
  if (logsTailChild?.kill) {
    logsTailChild.kill("SIGTERM");
  }
  void watcher.close().then(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
