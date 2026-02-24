/**
 * System Tray Manager — manages the menu bar / system tray icon.
 *
 * - macOS: Menu bar icon with green/yellow/red status indicator
 * - Windows: System tray icon with context menu
 * - Linux: App indicator / system tray
 */

import { Tray, Menu, nativeImage, app, dialog } from "electron";
import type { WindowManager } from "./window-manager.js";
import type { ContainerManager } from "./docker/container-manager.js";
import { APP_NAME } from "../shared/constants.js";
import type { EnvironmentHealth } from "../shared/ipc-types.js";

/** Tray icon size (pixels). */
const ICON_SIZE = 16;

/**
 * Creates a colored circle nativeImage for the tray icon.
 * Green = healthy, Yellow = degraded, Red = unhealthy, Gray = stopped/unknown.
 */
function createStatusIcon(health: EnvironmentHealth): Electron.NativeImage {
  const colors: Record<EnvironmentHealth, string> = {
    healthy: "#22c55e",
    degraded: "#eab308",
    unhealthy: "#ef4444",
    stopped: "#6b7280",
    unknown: "#6b7280",
  };
  const color = colors[health];

  // Create a simple colored circle as a data URL
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}">
      <circle cx="${ICON_SIZE / 2}" cy="${ICON_SIZE / 2}" r="${ICON_SIZE / 2 - 1}"
              fill="${color}" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
    </svg>
  `;
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return nativeImage.createFromDataURL(dataUrl);
}

export class TrayManager {
  private tray: Tray | null = null;
  private currentHealth: EnvironmentHealth = "unknown";

  constructor(
    private readonly windowManager: WindowManager,
    private readonly containers: ContainerManager,
  ) {}

  create(): void {
    const icon = createStatusIcon(this.currentHealth);
    this.tray = new Tray(icon);
    this.tray.setToolTip(`${APP_NAME} — ${this.currentHealth}`);
    this.updateContextMenu();

    // Click tray icon to toggle window
    this.tray.on("click", () => {
      this.windowManager.focusMainWindow();
    });
  }

  updateHealth(health: EnvironmentHealth): void {
    this.currentHealth = health;
    if (!this.tray) { return; }

    this.tray.setImage(createStatusIcon(health));
    this.tray.setToolTip(`${APP_NAME} — ${health}`);
    this.updateContextMenu();
  }

  private updateContextMenu(): void {
    if (!this.tray) { return; }

    const statusLabel =
      this.currentHealth === "healthy"
        ? "● Environment Running"
        : this.currentHealth === "stopped"
          ? "○ Environment Stopped"
          : `⚠ Environment ${this.currentHealth}`;

    const menu = Menu.buildFromTemplate([
      { label: statusLabel, enabled: false },
      { type: "separator" },
      {
        label: "Open Command Center",
        click: () => this.windowManager.focusMainWindow(),
      },
      { type: "separator" },
      {
        label: "Start Environment",
        enabled: this.currentHealth === "stopped",
        click: () => {
          this.containers.startEnvironment().catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            dialog.showErrorBox("Start Environment", `Failed to start: ${msg}`);
          });
        },
      },
      {
        label: "Stop Environment",
        enabled: this.currentHealth !== "stopped" && this.currentHealth !== "unknown",
        click: () => {
          this.containers.stopEnvironment().catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            dialog.showErrorBox("Stop Environment", `Failed to stop: ${msg}`);
          });
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(menu);
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}
