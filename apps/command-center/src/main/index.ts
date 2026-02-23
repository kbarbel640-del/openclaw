/**
 * OpenClaw Command Center — Electron Main Process Entry Point.
 *
 * Security hardening:
 *   - contextIsolation: true
 *   - nodeIntegration: false
 *   - sandbox: true
 *   - Strict CSP policy
 *   - IPC via typed preload bridge only
 */

import { app, BrowserWindow, nativeTheme } from "electron";
import path from "node:path";
import { WindowManager } from "./window-manager.js";
import { TrayManager } from "./tray-manager.js";
import { registerIpcHandlers } from "./ipc-handlers.js";
import { DockerEngineClient } from "./docker/engine-client.js";
import { ContainerManager } from "./docker/container-manager.js";
import { EngineDetector } from "./docker/engine-detector.js";
import { APP_NAME, APP_ID } from "../shared/constants.js";

// ─── Single Instance Lock ───────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  console.error(`[${APP_NAME}] Another instance is already running.`);
  app.quit();
}

// ─── App Setup ──────────────────────────────────────────────────────────────

app.setName(APP_NAME);
if (process.platform === "darwin") {
  app.dock?.setMenu(null);
}

// Security: disable navigation to external URLs
app.on("web-contents-created", (_event, contents) => {
  contents.on("will-navigate", (event) => {
    event.preventDefault();
  });
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
});

// ─── Services ───────────────────────────────────────────────────────────────

let windowManager: WindowManager;
let trayManager: TrayManager;
let dockerClient: DockerEngineClient;
let containerManager: ContainerManager;

// ─── App Lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  console.log(`[${APP_NAME}] Starting (pid: ${process.pid})`);

  // Detect Docker engine
  const detector = new EngineDetector();
  const engineInfo = await detector.detect();
  console.log(
    `[${APP_NAME}] Docker: ${engineInfo.variant} v${engineInfo.version} (running: ${engineInfo.running})`,
  );

  // Initialize Docker client
  dockerClient = new DockerEngineClient();
  containerManager = new ContainerManager(dockerClient);

  // Register IPC handlers (main process ↔ renderer bridge)
  registerIpcHandlers({ dockerClient, containerManager });

  // Create main window
  windowManager = new WindowManager();
  await windowManager.createMainWindow();

  // Create system tray
  trayManager = new TrayManager(windowManager);
  trayManager.create();

  console.log(`[${APP_NAME}] Ready.`);
});

// macOS: re-create window when dock icon clicked
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    windowManager?.createMainWindow();
  }
});

// Quit when all windows closed (except macOS — app stays in tray)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // On macOS, the app stays in the tray. On other platforms, quit.
    // But since we want tray behavior everywhere, we keep the app alive.
  }
});

// Graceful shutdown
app.on("before-quit", async () => {
  console.log(`[${APP_NAME}] Shutting down...`);
  trayManager?.destroy();
});

// Second instance tried to launch — bring existing window to front
app.on("second-instance", () => {
  windowManager?.focusMainWindow();
});
