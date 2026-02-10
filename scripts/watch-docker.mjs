#!/usr/bin/env node
/**
 * Watch Dockerfile and docker-compose.yml; on change run:
 *   docker compose up -d --build --force-recreate openclaw-gateway
 * Intended to be run as a long-lived daemon (e.g. under PM2).
 */
import chokidar from "chokidar";
import { spawn } from "node:child_process";
import process from "node:process";

const DEBOUNCE_MS = 1500;
const WATCH_FILES = ["Dockerfile", "docker-compose.yml"];
const CWD = process.cwd();

let debounceTimer = null;

function runCompose() {
  const cmd = "docker";
  const args = ["compose", "up", "-d", "--build", "--force-recreate", "openclaw-gateway"];
  const ts = new Date().toISOString();
  console.log(`[${ts}] Triggering: ${cmd} ${args.join(" ")}`);
  const child = spawn(cmd, args, {
    cwd: CWD,
    stdio: "inherit",
    shell: false,
  });
  child.on("close", (code, signal) => {
    const ts2 = new Date().toISOString();
    if (code === 0) {
      console.log(`[${ts2}] Rebuild finished successfully.`);
    } else {
      console.error(
        `[${ts2}] Rebuild exited with code=${code} signal=${signal}. Daemon keeps watching.`,
      );
    }
  });
  child.on("error", (err) => {
    console.error(`[${new Date().toISOString()}] Spawn error:`, err.message);
  });
}

function scheduleRebuild() {
  if (debounceTimer) clearTimeout(debounceTimer);
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
  if (debounceTimer) clearTimeout(debounceTimer);
  watcher.close().then(() => process.exit(0));
});
process.on("SIGTERM", () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  watcher.close().then(() => process.exit(0));
});
