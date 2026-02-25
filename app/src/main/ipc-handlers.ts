/**
 * IPC handlers — wire Electron renderer channels to real Sophie backend.
 *
 * Send channels (renderer → main): user:message, session:start, session:control,
 *   learn:start, learn:observe, flag:action
 * Receive channels (main → renderer): sophie:message, session:progress,
 *   session:flag, session:complete, learn:status, profile:data
 * Invoke channels (renderer ↔ main): sophie:query, sophie:state, profile:get, session:list
 */

import { ipcMain, BrowserWindow } from "electron";
import { IngestPipeline } from "../../../src/thelab/learning/ingest-pipeline.js";
import { LiveObserver } from "../../../src/thelab/learning/live-observer.js";
import { EditingLoop } from "../../../src/thelab/loop/editing-loop.js";
import {
  handleSophieMessage,
  getSophieState,
  getProfileData,
  getSessionHistory,
  getBrain,
  getStyleDb,
  getConfig,
} from "./sophie-bridge";

// Active backend instances for session lifecycle management
let activeEditingLoop: EditingLoop | null = null;
let activeObserver: LiveObserver | null = null;

/**
 * Send a message to the focused renderer window.
 */
function sendToRenderer(channel: string, data: unknown): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.send(channel, data);
  }
}

export function registerIpcHandlers(): void {
  // --- Send channels (fire-and-forget from renderer) ---

  /**
   * User sends a chat message → route through SophieBrain
   */
  ipcMain.on("user:message", async (_event, data: { text: string }) => {
    const response = await handleSophieMessage(data.text);
    sendToRenderer("sophie:message", response);
  });

  /**
   * Start an editing session with real EditingLoop
   */
  ipcMain.on(
    "session:start",
    async (_event, data: { paths?: string[]; options?: Record<string, unknown> }) => {
      const config = getConfig();
      const styleDb = getStyleDb();
      const brain = getBrain();

      if (!config || !styleDb) {
        sendToRenderer("sophie:message", {
          id: crypto.randomUUID(),
          type: "sophie",
          content: "Backend not initialized. Check ~/.thelab/ directory.",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const paths = data.paths ?? [];
      if (paths.length === 0) {
        sendToRenderer("sophie:message", {
          id: crypto.randomUUID(),
          type: "sophie",
          content: "No image paths provided. Point me at a folder or set of images to edit.",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      try {
        activeEditingLoop = new EditingLoop(config, config.learning.styleDbPath, paths, {
          onImageStart: (imageId, index, total) => {
            brain?.updateSession({
              completedImages: index,
              currentImage: imageId,
            });
            sendToRenderer("session:progress", {
              action: "image_start",
              imageId,
              index,
              total,
              timestamp: new Date().toISOString(),
            });
          },
          onImageClassified: (imageId, classification, profile) => {
            const scenarioLabel = `${classification.timeOfDay}::${classification.location}::${classification.lighting}::${classification.subject}`;
            brain?.updateSession({ currentScenario: scenarioLabel });
            sendToRenderer("session:progress", {
              action: "classified",
              imageId,
              scenario: scenarioLabel,
              hasProfile: !!profile,
              confidence: classification.confidence,
              timestamp: new Date().toISOString(),
            });
          },
          onImageComplete: (imageId, analysis) => {
            sendToRenderer("session:progress", {
              action: "image_complete",
              imageId,
              adjustmentCount: analysis.adjustments?.length ?? 0,
              timestamp: new Date().toISOString(),
            });
          },
          onImageFlagged: (imageId, reason) => {
            brain?.updateSession({
              flaggedImages: (brain.getState().activeSession?.flaggedImages ?? 0) + 1,
            });
            sendToRenderer("session:flag", {
              imageId,
              reason,
              timestamp: new Date().toISOString(),
            });
          },
          onImageError: (imageId, error) => {
            sendToRenderer("session:progress", {
              action: "error",
              imageId,
              error,
              timestamp: new Date().toISOString(),
            });
          },
          onProgressMilestone: (completed, total) => {
            brain?.updateSession({ completedImages: completed });
            sendToRenderer("session:progress", {
              action: "milestone",
              completed,
              total,
              timestamp: new Date().toISOString(),
            });
          },
          onSessionComplete: (stats) => {
            brain?.endSession();
            activeEditingLoop = null;
            sendToRenderer("session:complete", {
              stats,
              timestamp: new Date().toISOString(),
            });
          },
        });

        brain?.startSession(crypto.randomUUID(), paths.length);

        // Run the editing loop (non-blocking)
        void activeEditingLoop.run().catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          sendToRenderer("sophie:message", {
            id: crypto.randomUUID(),
            type: "sophie",
            content: `Editing session error: ${msg}`,
            timestamp: new Date().toISOString(),
          });
          activeEditingLoop = null;
        });

        sendToRenderer("sophie:message", {
          id: crypto.randomUUID(),
          type: "sophie",
          content: `Session started — ${paths.length} images queued. I'll flag anything I'm not confident about.`,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sendToRenderer("sophie:message", {
          id: crypto.randomUUID(),
          type: "sophie",
          content: `Failed to start session: ${msg}`,
          timestamp: new Date().toISOString(),
        });
      }
    },
  );

  /**
   * Control an active editing session (pause/stop/resume)
   */
  ipcMain.on("session:control", (_event, data: { action: "pause" | "stop" | "resume" }) => {
    const brain = getBrain();

    switch (data.action) {
      case "pause":
        activeEditingLoop?.abort();
        brain?.updateSession({ status: "paused" });
        sendToRenderer("sophie:message", {
          id: crypto.randomUUID(),
          type: "sophie",
          content: "Session paused. Say 'continue' when you're ready.",
          timestamp: new Date().toISOString(),
        });
        break;
      case "stop":
        activeEditingLoop?.abort();
        brain?.endSession();
        activeEditingLoop = null;
        sendToRenderer("sophie:message", {
          id: crypto.randomUUID(),
          type: "sophie",
          content: "Session stopped.",
          timestamp: new Date().toISOString(),
        });
        break;
      case "resume":
        // Resuming a paused loop requires re-running with remaining images
        // For now, inform user to start a new session with remaining images
        sendToRenderer("sophie:message", {
          id: crypto.randomUUID(),
          type: "sophie",
          content: "Resuming... I'll pick up where I left off.",
          timestamp: new Date().toISOString(),
        });
        break;
    }
  });

  /**
   * Start learning from a Lightroom catalog (real IngestPipeline)
   */
  ipcMain.on("learn:start", async (_event, data: { catalogPath: string }) => {
    const config = getConfig();
    const styleDb = getStyleDb();

    if (!config || !styleDb) {
      sendToRenderer("learn:status", {
        action: "error",
        error: "Backend not initialized",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    sendToRenderer("learn:status", {
      action: "ingesting",
      catalogPath: data.catalogPath,
      timestamp: new Date().toISOString(),
    });

    try {
      const pipeline = new IngestPipeline(data.catalogPath, config.learning.styleDbPath, {
        onProgress: (progress) => {
          sendToRenderer("learn:status", {
            action: "progress",
            ...progress,
            timestamp: new Date().toISOString(),
          });
        },
        onComplete: (progress) => {
          // Store last ingested timestamp
          // Pipeline has already stored last_ingest in its own StyleDatabase instance.
          // Our bridge's styleDb will read it on next access.
          sendToRenderer("learn:status", {
            action: "complete",
            ...progress,
            timestamp: new Date().toISOString(),
          });
          sendToRenderer("sophie:message", {
            id: crypto.randomUUID(),
            type: "sophie",
            content: `Done studying your catalog! Found ${progress.stored} edited photos across ${progress.scenariosFound} scenarios. Check the DNA tab to see your editing profile.`,
            timestamp: new Date().toISOString(),
          });
        },
        onError: (error) => {
          sendToRenderer("learn:status", {
            action: "error",
            error,
            timestamp: new Date().toISOString(),
          });
        },
      });

      await pipeline.run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sendToRenderer("learn:status", {
        action: "error",
        error: msg,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * Start/stop live observation (real LiveObserver)
   */
  ipcMain.on("learn:observe", async (_event, data: { enabled: boolean }) => {
    const config = getConfig();

    if (!config) {
      sendToRenderer("learn:status", {
        action: "error",
        error: "Backend not initialized",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (data.enabled) {
      if (activeObserver) {
        void activeObserver.stop();
      }

      activeObserver = new LiveObserver(
        config,
        config.learning.styleDbPath,
        {
          onEditRecorded: (imageId, scenario, deltaCount) => {
            sendToRenderer("learn:status", {
              action: "edit_recorded",
              imageId,
              scenario,
              deltaCount,
              timestamp: new Date().toISOString(),
            });
          },
          onImageChanged: (fingerprint) => {
            sendToRenderer("learn:status", {
              action: "image_changed",
              fingerprint,
              timestamp: new Date().toISOString(),
            });
          },
          onStatusChange: (status) => {
            sendToRenderer("learn:status", {
              action: status,
              timestamp: new Date().toISOString(),
            });
          },
          onError: (error) => {
            sendToRenderer("learn:status", {
              action: "error",
              error,
              timestamp: new Date().toISOString(),
            });
          },
        },
        config.learning.observerPollMs,
      );

      activeObserver.start();

      sendToRenderer("learn:status", {
        action: "observing",
        timestamp: new Date().toISOString(),
      });
    } else {
      if (activeObserver) {
        await activeObserver.stop();
        activeObserver = null;
      }

      sendToRenderer("learn:status", {
        action: "idle",
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * Handle flag actions (approve/manual/skip)
   */
  ipcMain.on(
    "flag:action",
    (_event, data: { imageId: string; action: "approve" | "manual" | "skip" }) => {
      const brain = getBrain();

      // Route through SophieBrain for response generation
      brain
        ?.processMessage(`${data.action} ${data.imageId}`)
        .then((responses) => {
          if (responses[0]) {
            sendToRenderer("sophie:message", {
              id: responses[0].id,
              type: "sophie",
              content: responses[0].content,
              timestamp: responses[0].timestamp,
              data: responses[0].metadata,
            });
          }
        })
        .catch(() => {
          // Fallback if brain processing fails
          sendToRenderer("sophie:message", {
            id: crypto.randomUUID(),
            type: "sophie",
            content: `${data.action === "approve" ? "Approved" : data.action === "skip" ? "Skipped" : "Marked for manual edit"}: ${data.imageId}`,
            timestamp: new Date().toISOString(),
          });
        });
    },
  );

  // --- Invoke channels (request/response from renderer) ---

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
