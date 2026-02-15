/**
 * Workflow checkpointing system.
 *
 * Enables multi-agent workflows to survive failures by saving progress
 * at key points and resuming from the last checkpoint.
 *
 * Checkpoint lifecycle:
 * 1. Created before batch spawn (captures intent + pending work)
 * 2. Updated after each subtask completion (captures progress)
 * 3. Used for resume on failure or gateway restart
 * 4. Auto-cleaned after 24h (archived), 7d (deleted)
 */

import crypto from "node:crypto";
import {
  loadCheckpointIndex,
  saveCheckpointIndex,
  saveCheckpointData,
  loadCheckpointData,
  deleteCheckpointData,
  type CheckpointData,
} from "./workflow-checkpoint-store.js";

const checkpoints = new Map<string, CheckpointData>();
let sweepTimer: NodeJS.Timeout | null = null;
let restored = false;

const ARCHIVE_AFTER_MS = 24 * 60 * 60_000; // 24h
const DELETE_AFTER_MS = 7 * 24 * 60 * 60_000; // 7d

// ── Restore ──

/** Restore checkpoints from disk. Call once at startup. */
export function restoreCheckpoints(): void {
  if (restored) {
    return;
  }
  restored = true;
  try {
    const loaded = loadCheckpointIndex();
    for (const [id, cp] of loaded.entries()) {
      if (!checkpoints.has(id)) {
        checkpoints.set(id, cp);
      }
    }
  } catch {
    // ignore
  }
  startSweeper();
}

// ── Create / Update ──

/**
 * Create a new workflow checkpoint.
 */
export function createCheckpoint(params: {
  workflowId: string;
  phase: string;
  pendingSubtaskIds: string[];
  sharedContext?: Record<string, unknown>;
}): CheckpointData {
  const now = Date.now();
  const cp: CheckpointData = {
    id: crypto.randomUUID(),
    workflowId: params.workflowId,
    phase: params.phase,
    completedSubtasks: {},
    pendingSubtaskIds: params.pendingSubtaskIds,
    sharedContext: params.sharedContext ?? {},
    createdAt: now,
    updatedAt: now,
  };

  checkpoints.set(cp.id, cp);
  persistCheckpoint(cp);
  return cp;
}

/**
 * Record a subtask completion in a checkpoint.
 */
export function recordSubtaskCompletion(
  checkpointId: string,
  subtaskId: string,
  result: { result?: string; model?: string; tokens?: number },
): void {
  const cp = checkpoints.get(checkpointId);
  if (!cp) {
    return;
  }

  cp.completedSubtasks[subtaskId] = result;
  cp.pendingSubtaskIds = cp.pendingSubtaskIds.filter((id) => id !== subtaskId);
  cp.updatedAt = Date.now();

  persistCheckpoint(cp);
}

/**
 * Update shared context in a checkpoint.
 */
export function updateCheckpointContext(
  checkpointId: string,
  context: Record<string, unknown>,
): void {
  const cp = checkpoints.get(checkpointId);
  if (!cp) {
    return;
  }

  cp.sharedContext = { ...cp.sharedContext, ...context };
  cp.updatedAt = Date.now();

  persistCheckpoint(cp);
}

// ── Query ──

/** Get a checkpoint by ID. */
export function getCheckpoint(id: string): CheckpointData | null {
  // Try in-memory first
  const cp = checkpoints.get(id);
  if (cp) {
    return cp;
  }
  // Try disk
  const fromDisk = loadCheckpointData(id);
  if (fromDisk) {
    checkpoints.set(id, fromDisk);
  }
  return fromDisk;
}

/** List all active checkpoints for a workflow. */
export function listCheckpointsForWorkflow(workflowId: string): CheckpointData[] {
  return Array.from(checkpoints.values())
    .filter((cp) => cp.workflowId === workflowId)
    .toSorted((a, b) => b.updatedAt - a.updatedAt);
}

/** List all checkpoints. */
export function listAllCheckpoints(): CheckpointData[] {
  return Array.from(checkpoints.values()).toSorted((a, b) => b.updatedAt - a.updatedAt);
}

/** Get the latest checkpoint for a workflow. */
export function getLatestCheckpoint(workflowId: string): CheckpointData | null {
  const wfCheckpoints = listCheckpointsForWorkflow(workflowId);
  return wfCheckpoints[0] ?? null;
}

// ── Resume ──

/**
 * Prepare a resume plan from a checkpoint.
 * Returns the list of incomplete subtask IDs and the shared context.
 */
export function prepareResumePlan(checkpointId: string): {
  checkpoint: CheckpointData;
  incompleteSubtaskIds: string[];
  completedResults: Record<string, { result?: string; model?: string; tokens?: number }>;
  sharedContext: Record<string, unknown>;
} | null {
  const cp = getCheckpoint(checkpointId);
  if (!cp) {
    return null;
  }

  return {
    checkpoint: cp,
    incompleteSubtaskIds: [...cp.pendingSubtaskIds],
    completedResults: { ...cp.completedSubtasks },
    sharedContext: { ...cp.sharedContext },
  };
}

// ── Cleanup ──

/** Delete a specific checkpoint. */
export function deleteCheckpoint(id: string): void {
  checkpoints.delete(id);
  deleteCheckpointData(id);
  persistIndex();
}

function persistCheckpoint(cp: CheckpointData): void {
  try {
    saveCheckpointData(cp);
    persistIndex();
  } catch {
    // ignore
  }
}

function persistIndex(): void {
  try {
    saveCheckpointIndex(checkpoints);
  } catch {
    // ignore
  }
}

function startSweeper(): void {
  if (sweepTimer) {
    return;
  }
  sweepTimer = setInterval(() => {
    sweepCheckpoints();
  }, 60 * 60_000); // every hour
  sweepTimer.unref?.();
}

function sweepCheckpoints(): void {
  const now = Date.now();
  let mutated = false;

  for (const [id, cp] of checkpoints.entries()) {
    const age = now - cp.createdAt;

    // Delete checkpoints older than 7 days
    if (age > DELETE_AFTER_MS) {
      checkpoints.delete(id);
      deleteCheckpointData(id);
      mutated = true;
      continue;
    }

    // Archive (remove from memory but keep on disk) after 24h
    // Only archive fully completed checkpoints
    if (age > ARCHIVE_AFTER_MS && cp.pendingSubtaskIds.length === 0) {
      checkpoints.delete(id);
      mutated = true;
    }
  }

  if (mutated) {
    persistIndex();
  }
}

/** Reset for test isolation. */
export function resetCheckpointsForTests(): void {
  checkpoints.clear();
  restored = false;
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}
