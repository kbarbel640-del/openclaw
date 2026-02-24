import { ipcMain, BrowserWindow } from "electron";
import {
  handleSophieMessage,
  getSophieState,
  getProfileData,
  getSessionHistory,
} from "./sophie-bridge";

export function registerIpcHandlers(): void {
  ipcMain.on("user:message", async (_event, data: { text: string }) => {
    const response = await handleSophieMessage(data.text);
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.send("sophie:message", response);
    }
  });

  ipcMain.on(
    "session:start",
    async (_event, data: { paths?: string[]; options?: Record<string, unknown> }) => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        win.webContents.send("sophie:message", {
          id: crypto.randomUUID(),
          type: "sophie",
          content: `Starting session with ${data.paths?.length ?? 0} images.`,
          timestamp: new Date().toISOString(),
        });
      }
    },
  );

  ipcMain.on("session:control", (_event, data: { action: "pause" | "stop" | "resume" }) => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.send("sophie:message", {
        id: crypto.randomUUID(),
        type: "sophie",
        content: `Session ${data.action}d.`,
        timestamp: new Date().toISOString(),
      });
    }
  });

  ipcMain.on("learn:start", async (_event, data: { catalogPath: string }) => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.send("learn:status", {
        action: "ingesting",
        catalogPath: data.catalogPath,
        timestamp: new Date().toISOString(),
      });
    }
  });

  ipcMain.on("learn:observe", (_event, data: { enabled: boolean }) => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.send("learn:status", {
        action: data.enabled ? "observing" : "idle",
        timestamp: new Date().toISOString(),
      });
    }
  });

  ipcMain.on(
    "flag:action",
    (_event, data: { imageId: string; action: "approve" | "manual" | "skip" }) => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        win.webContents.send("sophie:message", {
          id: crypto.randomUUID(),
          type: "sophie",
          content: `${data.action === "approve" ? "Approved" : data.action === "skip" ? "Skipped" : "Marked for manual edit"}: ${data.imageId}`,
          timestamp: new Date().toISOString(),
        });
      }
    },
  );

  ipcMain.handle("sophie:query", async (_event, data: { query: string }) => {
    return handleSophieMessage(data.query);
  });

  ipcMain.handle("profile:get", async () => {
    return getProfileData();
  });

  ipcMain.handle("session:list", async () => {
    return getSessionHistory();
  });

  ipcMain.handle("sophie:state", async () => {
    return getSophieState();
  });
}
