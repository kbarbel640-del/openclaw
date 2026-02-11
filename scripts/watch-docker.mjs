#!/usr/bin/env node
/**
 * Watch Dockerfile and docker-compose.yml; on change run:
 *   docker compose up -d --build --force-recreate openclaw-gateway
 * Intended to be run as a long-lived daemon (e.g. under PM2).
 */
import chokidar from "chokidar";
import { spawn } from "node:child_process";
import process from "node:process";

const DEBOUNCE_MS = 3000;
const WATCH_FILES = ["Dockerfile", "docker-compose.yml"];
const CWD = process.cwd();

let debounceTimer = null;
let running = false;
/** 目前正在跑的 compose 子行程，供執行中觸發時 kill */
let composeChild = null;
/** 當前 run 的 id，被 kill 後啟動新 run 時遞增，用於忽略舊 run 的 .then() */
let currentRunId = 0;

function run(cmd, args, opts = {}) {
  const childRef = opts.childRef || {};
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: CWD, stdio: opts.capture ? "pipe" : "inherit", ...opts });
    childRef.current = child;
    let stderr = "";
    if (opts.capture && child.stderr) {
      child.stderr.on("data", (d) => (stderr += d.toString()));
    }
    child.on("close", (code, signal) => resolve({ code, signal, stderr }));
    child.on("error", () => resolve({ code: 1, signal: null, stderr: "" }));
  });
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
  const myRunId = ++currentRunId;
  const childRef = {};
  const ts = new Date().toISOString();
  console.log(`[${ts}] Triggering: docker compose up -d --build --force-recreate openclaw-gateway`);
  run("docker", ["compose", "up", "-d", "--build", "--force-recreate", "openclaw-gateway"], {
    capture: true,
    childRef,
  }).then(({ code, signal, stderr }) => {
    composeChild = null;
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
      console.log(`[${ts2}] Rebuild finished successfully.`);
      return;
    }
    const conflictMatch =
      !retrying && stderr.match(/container name "(\/[^"]+)" is already in use by container/);
    if (conflictMatch) {
      const name = conflictMatch[1].replace(/^\//, "");
      console.log(`[${ts2}] Removing conflicting container "${name}" and retrying…`);
      run("docker", ["rm", "-f", name]).then(() => runCompose(true));
      return;
    }
    console.error(`[${ts2}] Rebuild exited with code=${code}. Daemon keeps watching.`);
  });
  composeChild = childRef.current;
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
});

watcher.on("change", (path) => {
  console.log(`[${new Date().toISOString()}] ${path} changed.`);
  scheduleRebuild();
});

watcher.on("add", (path) => {
  if (WATCH_FILES.includes(path)) {
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
});

process.on("SIGINT", () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  watcher.close().then(() => process.exit(0));
});
process.on("SIGTERM", () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  watcher.close().then(() => process.exit(0));
});
