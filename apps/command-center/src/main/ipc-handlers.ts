/**
 * IPC Handlers — registers all main-process handlers for the renderer bridge.
 *
 * Every IPC handler validates the caller's auth session before executing.
 * Sensitive operations require elevated (re-authenticated) sessions.
 */

import { ipcMain } from "electron";
import { totalmem } from "node:os";
import { IPC_CHANNELS } from "../shared/ipc-types.js";
import type { DockerEngineClient } from "./docker/engine-client.js";
import type { ContainerManager } from "./docker/container-manager.js";
import type { SessionManager } from "./auth/session-manager.js";
import { EngineDetector } from "./docker/engine-detector.js";
import { ImageManager } from "./docker/image-manager.js";
import { NetworkManager } from "./docker/network-manager.js";
import { VolumeManager } from "./docker/volume-manager.js";
import { ComposeOrchestrator } from "./docker/compose-orchestrator.js";
import { requireSession, requireElevatedSession, validateStackConfig } from "./ipc-guards.js";

interface IpcDependencies {
  dockerClient: DockerEngineClient;
  containerManager: ContainerManager;
  sessionManager: SessionManager;
}


export function registerIpcHandlers(deps: IpcDependencies): void {
  const { dockerClient, containerManager, sessionManager } = deps;
  const detector = new EngineDetector();

  // Build orchestrator from the shared docker client (stateless wrappers)
  const imageManager = new ImageManager(dockerClient);
  const networkManager = new NetworkManager(dockerClient);
  const volumeManager = new VolumeManager(dockerClient);
  const orchestrator = new ComposeOrchestrator(
    containerManager,
    imageManager,
    networkManager,
    volumeManager,
  );

  // ─── Docker Info (public — used by installer before login) ───────────────

  ipcMain.handle(IPC_CHANNELS.DOCKER_INFO, async () => {
    return detector.detect();
  });

  // ─── Environment Status ─────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.ENV_STATUS, async (_event, token: unknown) => {
    requireSession(token, sessionManager);
    return containerManager.getEnvironmentStatus();
  });

  ipcMain.handle(IPC_CHANNELS.ENV_CREATE, async (_event, token: unknown, rawConfig: unknown) => {
    requireElevatedSession(token, sessionManager);
    const config = validateStackConfig(rawConfig);
    await orchestrator.up(config);
  });

  ipcMain.handle(IPC_CHANNELS.ENV_START, async (_event, token: unknown) => {
    requireSession(token, sessionManager);
    await containerManager.startEnvironment();
  });

  ipcMain.handle(IPC_CHANNELS.ENV_STOP, async (_event, token: unknown) => {
    requireSession(token, sessionManager);
    await containerManager.stopEnvironment();
  });

  ipcMain.handle(IPC_CHANNELS.ENV_DESTROY, async (_event, token: unknown) => {
    requireElevatedSession(token, sessionManager);
    await orchestrator.down();
  });

  ipcMain.handle(IPC_CHANNELS.ENV_LOGS, async (_event, token: unknown, containerId: unknown) => {
    requireSession(token, sessionManager);
    if (typeof containerId !== "string") { return ""; }
    return dockerClient.getContainerLogs(containerId, { tail: 200 });
  });

  // ─── System Validation (public — used in installer/setup flow) ────────────

  ipcMain.handle(IPC_CHANNELS.SYSTEM_VALIDATE, async () => {
    const dockerInfo = await detector.detect();
    const checks = [];

    // Docker check
    checks.push({
      name: "Container Engine",
      description: "Docker or compatible engine is installed and running",
      result: dockerInfo.running ? "pass" : "fail",
      message: dockerInfo.running
        ? `${dockerInfo.variant} v${dockerInfo.version} detected`
        : "No container engine detected. Install Docker Desktop or Docker CE.",
      autoFixAvailable: !dockerInfo.running,
    });

    // Platform check
    const os = process.platform;
    const supported = ["darwin", "win32", "linux"].includes(os);
    checks.push({
      name: "Operating System",
      description: "Compatible operating system",
      result: supported ? "pass" : "fail",
      message: supported ? `${os} is supported` : `${os} is not supported`,
      autoFixAvailable: false,
    });

    // Node.js version check
    const nodeVersion = process.versions.node;
    const [major] = nodeVersion.split(".").map(Number);
    checks.push({
      name: "Node.js Runtime",
      description: "Node.js 22.12.0 or later",
      result: major >= 22 ? "pass" : "fail",
      message:
        major >= 22
          ? `Node.js v${nodeVersion}`
          : `Node.js v${nodeVersion} — upgrade to v22.12.0+`,
      autoFixAvailable: false,
    });

    // Memory check
    const totalMemGB = Math.round((totalmem() / 1024 / 1024 / 1024) * 10) / 10;
    checks.push({
      name: "Available Memory",
      description: "At least 4 GB RAM recommended",
      result: totalMemGB >= 4 ? "pass" : "warn",
      message: `${totalMemGB} GB total RAM`,
      autoFixAvailable: false,
    });

    const allPassed = checks.every((c) => c.result === "pass");
    const canProceed = checks.every((c) => c.result !== "fail");

    return { checks, allPassed, canProceed };
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_PLATFORM, async () => {
    return {
      os: process.platform,
      arch: process.arch,
      version: process.version,
    };
  });

  // ─── Config (placeholder) ───────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.CONFIG_SECTIONS, async (_event, token: unknown) => {
    requireSession(token, sessionManager);
    // Will be populated in Phase 4 — returns config section metadata
    return [];
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, async (_event, token: unknown, _section: unknown) => {
    requireSession(token, sessionManager);
    return {};
  });

  // ─── Skills (placeholder) ──────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.SKILLS_LIST, async (_event, token: unknown) => {
    requireSession(token, sessionManager);
    // Will be populated in Phase 5
    return [];
  });
}
