#!/usr/bin/env node
import { spawn } from "node:child_process";
/**
 * Tail openclaw-gateway container logs to logs/openclaw-gateway.log with rotation.
 * Run as long-lived daemon (e.g. PM2) alongside docker compose.
 *
 * Rotation: when file exceeds MAX_SIZE_MB, rotate (keep last MAX_FILES).
 * Use logrotate for system-wide rotation, or rely on this built-in rotation.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const CWD = process.cwd();
const LOG_DIR = path.join(CWD, "logs");
const LOG_FILE = path.join(LOG_DIR, "openclaw-gateway.log");
const MAX_SIZE_MB = 10;
const MAX_FILES = 3;

function ensureLogDir() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function rotateIfNeeded(stream, currentSize) {
  if (currentSize < MAX_SIZE_MB * 1024 * 1024) {
    return null;
  }
  const oldStream = stream;
  const tmpPath = LOG_FILE + ".rotating";
  const newStream = fs.createWriteStream(tmpPath, { flags: "a" });
  for (let i = MAX_FILES - 1; i >= 1; i--) {
    const src = path.join(LOG_DIR, `openclaw-gateway.log.${i}`);
    const dst = path.join(LOG_DIR, `openclaw-gateway.log.${i + 1}`);
    try {
      fs.renameSync(src, dst);
    } catch {
      /* 不存在則略過 */
    }
  }
  try {
    fs.renameSync(LOG_FILE, path.join(LOG_DIR, "openclaw-gateway.log.1"));
  } catch {
    /* 略過 */
  }
  try {
    fs.renameSync(tmpPath, LOG_FILE);
  } catch (e) {
    newStream.close();
    throw e;
  }
  oldStream.end();
  return newStream;
}

function tail() {
  ensureLogDir();
  let stream = fs.createWriteStream(LOG_FILE, { flags: "a" });
  let size = 0;
  try {
    const stat = fs.statSync(LOG_FILE);
    size = stat.size;
  } catch {
    /* 新建檔 */
  }

  const child = spawn("docker", ["compose", "logs", "-f", "--no-log-prefix", "openclaw-gateway"], {
    cwd: CWD,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const write = (chunk) => {
    const s = stream;
    if (!s.writable) {
      return;
    }
    s.write(chunk);
    size += chunk.length;
    const next = rotateIfNeeded(s, size);
    if (next) {
      stream = next;
      size = 0;
    }
  };

  child.stdout?.on("data", write);
  child.stderr?.on("data", write);
  child.on("close", (code, signal) => {
    stream.end();
    const ts = new Date().toISOString();
    // code=0 通常是容器停止，不需急著重啟；非 0 才用較短間隔
    const delayMs = code === 0 ? 30_000 : 5000;
    console.error(
      `[${ts}] docker compose logs exited code=${code} signal=${signal}, restarting in ${delayMs / 1000}s…`,
    );
    setTimeout(tail, delayMs);
  });
  child.on("error", (err) => {
    stream.end();
    console.error(`[${new Date().toISOString()}] spawn error:`, err.message);
    setTimeout(tail, 5000);
  });
}

tail();
