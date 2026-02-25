import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

interface WindowInfo {
  windowId: number;
  title: string;
  app: string;
  pid: number;
  bounds: { x: number; y: number; width: number; height: number };
}

/**
 * Manages Lightroom window detection and focus using Peekaboo.
 */
export class LightroomWindow {
  private appName: string;
  private cachedWindowId: number | null = null;

  constructor(appName = "Adobe Lightroom Classic") {
    this.appName = appName;
  }

  async findWindow(): Promise<WindowInfo | null> {
    try {
      const { stdout } = await execFileAsync("peekaboo", [
        "list",
        "windows",
        "--app",
        this.appName,
        "--json",
      ]);

      const windows = JSON.parse(stdout);
      if (!Array.isArray(windows) || windows.length === 0) {
        return null;
      }

      const mainWindow = windows[0];
      this.cachedWindowId = mainWindow.windowId ?? mainWindow.id;
      return mainWindow;
    } catch (error) {
      console.error("[LightroomWindow] Failed to find window:", error);
      return null;
    }
  }

  async isRunning(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync("peekaboo", ["list", "apps", "--json"]);
      const apps = JSON.parse(stdout);
      return (
        Array.isArray(apps) &&
        apps.some((app: { name?: string }) => app.name?.toLowerCase().includes("lightroom"))
      );
    } catch {
      return false;
    }
  }

  async focus(): Promise<boolean> {
    try {
      await execFileAsync("peekaboo", ["window", "focus", "--app", this.appName]);
      await this.sleep(500);
      return true;
    } catch (error) {
      console.error("[LightroomWindow] Failed to focus:", error);
      return false;
    }
  }

  async launch(): Promise<boolean> {
    try {
      await execFileAsync("peekaboo", ["app", "launch", this.appName]);
      await this.sleep(3000);
      return true;
    } catch (error) {
      console.error("[LightroomWindow] Failed to launch:", error);
      return false;
    }
  }

  async captureScreenshot(outputPath: string): Promise<boolean> {
    try {
      await execFileAsync("peekaboo", [
        "image",
        "--app",
        this.appName,
        "--retina",
        "--path",
        outputPath,
      ]);
      return true;
    } catch (error) {
      console.error("[LightroomWindow] Screenshot failed:", error);
      return false;
    }
  }

  /**
   * Capture an annotated snapshot for element targeting.
   * Returns the snapshot ID for subsequent click/type commands.
   */
  async captureAnnotatedSnapshot(outputPath: string): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync("peekaboo", [
        "see",
        "--app",
        this.appName,
        "--annotate",
        "--path",
        outputPath,
        "--json",
      ]);
      const result = JSON.parse(stdout);
      return result.snapshotId ?? result.snapshot_id ?? null;
    } catch (error) {
      console.error("[LightroomWindow] Annotated snapshot failed:", error);
      return null;
    }
  }

  getWindowId(): number | null {
    return this.cachedWindowId;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
