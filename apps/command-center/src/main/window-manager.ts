/**
 * Window Manager — creates and manages the main BrowserWindow.
 *
 * Security:
 *   - contextIsolation: true (renderer cannot access Node.js)
 *   - nodeIntegration: false
 *   - sandbox: true (full Chromium sandbox)
 *   - Strict CSP via meta tag in HTML
 */

import { BrowserWindow, screen } from "electron";
import path from "node:path";
import { APP_NAME } from "../shared/constants.js";

/**
 * Content Security Policy for the renderer.
 * - No inline scripts/styles (prevents XSS)
 * - Only loads from 'self'
 * - Blocks all plugins and frames
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // React needs inline for dynamic styles
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' ws://localhost:* http://localhost:*",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;

  async createMainWindow(): Promise<BrowserWindow> {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

    this.mainWindow = new BrowserWindow({
      width: Math.min(1400, screenWidth),
      height: Math.min(900, screenHeight),
      minWidth: 900,
      minHeight: 600,
      title: APP_NAME,
      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
      show: false, // Show after ready-to-show for smooth launch
      backgroundColor: "#0a0a0f",
      webPreferences: {
        preload: path.join(__dirname, "../preload/index.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webviewTag: false,
        spellcheck: false,
        devTools: process.env.NODE_ENV !== "production",
      },
    });

    // Inject CSP header on all responses
    this.mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [CSP],
        },
      });
    });

    // Smooth window appearance
    this.mainWindow.once("ready-to-show", () => {
      this.mainWindow?.show();
    });

    // Track window close — don't destroy on macOS (stays in tray)
    this.mainWindow.on("close", (event) => {
      if (process.platform === "darwin") {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });

    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
    });

    // Load the renderer
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      await this.mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      await this.mainWindow.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      );
    }

    return this.mainWindow;
  }

  focusMainWindow(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.mainWindow.focus();
    } else {
      this.createMainWindow();
    }
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }
}

// Electron Forge Vite plugin injects these globals at build time
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;
