/**
 * Session Bridge
 *
 * Connects Sophie's domain-specific session state (editing sessions,
 * style database, learning progress) with OpenClaw's session infrastructure.
 *
 * OpenClaw handles: conversation history, context window, compaction, LLM calls
 * Sophie handles: editing session state, style profiles, image processing queue
 *
 * This bridge lets both systems coexist — OpenClaw manages the conversation,
 * Sophie manages the photo editing state.
 */

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_CONFIG } from "../../../src/thelab/config/defaults.js";
import { resolveConfigPaths } from "../../../src/thelab/config/thelab-config.js";
import type { TheLabConfig } from "../../../src/thelab/config/thelab-config.js";
import { StyleDatabase } from "../../../src/thelab/learning/style-db.js";
import { SessionStore } from "../../../src/thelab/session/session-store.js";

export interface SophieSessionState {
  styleDb: StyleDatabase;
  config: TheLabConfig;
  editingSession: SessionStore | null;
  learningActive: boolean;
  observing: boolean;
}

let sessionState: SophieSessionState | null = null;

/**
 * Initialize or retrieve Sophie's session state.
 * Lazy initialization — only opens the DB when first needed.
 */
export function getSophieSession(): SophieSessionState {
  if (sessionState) return sessionState;

  const config = resolveConfigPaths({ ...DEFAULT_CONFIG });

  const dbDir = path.dirname(config.learning.styleDbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  sessionState = {
    styleDb: new StyleDatabase(config.learning.styleDbPath),
    config,
    editingSession: null,
    learningActive: false,
    observing: false,
  };

  return sessionState;
}

/**
 * Start a new editing session within Sophie's state.
 */
export function startEditingSession(sessionName: string, imagePaths: string[]): SessionStore {
  const state = getSophieSession();

  const sessionDir = state.config.session.sessionDir;
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  state.editingSession = new SessionStore(sessionDir, sessionName, imagePaths);
  return state.editingSession;
}

/**
 * Get the current editing session, or null if none active.
 */
export function getEditingSession(): SessionStore | null {
  return sessionState?.editingSession ?? null;
}

/**
 * Clean up resources on shutdown.
 */
export function closeSophieSession(): void {
  if (sessionState) {
    sessionState.styleDb.close();
    sessionState = null;
  }
}
