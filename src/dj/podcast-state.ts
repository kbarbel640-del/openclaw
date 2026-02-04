/**
 * Podcast State Management
 *
 * Handles atomic episode ID allocation with collision prevention.
 * Uses write-rename pattern for atomic file updates.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { EpisodeId, PodcastState } from "./podcast-types.js";

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_STATE_DIR = join(homedir(), ".openclaw", "state");
export const DEFAULT_STATE_FILE = join(DEFAULT_STATE_DIR, "dj-podcast.json");

// =============================================================================
// State File Operations
// =============================================================================

/**
 * Load podcast state from file.
 * Returns fresh state if file doesn't exist or is corrupted.
 */
export function loadPodcastState(filePath: string = DEFAULT_STATE_FILE): PodcastState {
  try {
    if (existsSync(filePath)) {
      const data = readFileSync(filePath, "utf-8");
      const state = JSON.parse(data) as PodcastState;

      // Validate state structure
      if (
        typeof state.nextEpisodeNumber === "number" &&
        state.nextEpisodeNumber >= 1 &&
        typeof state.updatedAt === "string"
      ) {
        return state;
      }
    }
  } catch {
    // Return fresh state on parse error
  }

  return {
    nextEpisodeNumber: 1,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Save podcast state atomically (temp file + rename).
 */
export function savePodcastState(state: PodcastState, filePath: string = DEFAULT_STATE_FILE): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Atomic write: temp file + rename
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), "utf-8");
  renameSync(tmp, filePath);
}

// =============================================================================
// Episode ID Formatting
// =============================================================================

/**
 * Format episode number as E### string.
 * Numbers 1-999 get 3-digit padding, 1000+ use actual digits.
 */
export function formatEpisodeId(num: number): EpisodeId {
  if (num < 1) {
    throw new Error(`Episode number must be >= 1, got ${num}`);
  }
  return `E${String(num).padStart(3, "0")}`;
}

/**
 * Parse episode ID to number.
 * @throws Error if format is invalid
 */
export function parseEpisodeId(id: string): number {
  const match = id.match(/^E(\d{3,})$/);
  if (!match) {
    throw new Error(`Invalid episode ID format: ${id}. Expected E### (e.g., E001, E042)`);
  }
  return parseInt(match[1], 10);
}

/**
 * Validate if a string is a valid episode ID format.
 */
export function isValidEpisodeId(id: string): id is EpisodeId {
  return /^E\d{3,}$/.test(id);
}

// =============================================================================
// Episode ID Allocation
// =============================================================================

/**
 * Allocate next episode ID atomically.
 *
 * IMPORTANT: This pre-allocates the ID and increments the counter.
 * If subsequent operations (like Notion creation) fail, call rollbackEpisodeId().
 */
export function allocateEpisodeId(filePath: string = DEFAULT_STATE_FILE): EpisodeId {
  const state = loadPodcastState(filePath);
  const episodeId = formatEpisodeId(state.nextEpisodeNumber);

  // Pre-allocate: increment and save
  state.nextEpisodeNumber++;
  state.lastAllocatedId = episodeId;
  state.updatedAt = new Date().toISOString();
  savePodcastState(state, filePath);

  return episodeId;
}

/**
 * Verify episode ID is not already used.
 * Used when --episode override is provided.
 *
 * @param episodeId - The episode ID to check
 * @param existingIds - List of existing episode IDs (from Notion or local)
 * @param filePath - State file path for counter check
 */
export function isEpisodeIdAvailable(
  episodeId: EpisodeId,
  existingIds: EpisodeId[],
  filePath: string = DEFAULT_STATE_FILE,
): boolean {
  // Check against existing IDs (from Notion query)
  if (existingIds.includes(episodeId)) {
    return false;
  }

  // Check against state file - if ID number < nextEpisodeNumber,
  // it was previously allocated and is reserved (even if Notion creation failed)
  const state = loadPodcastState(filePath);
  const requestedNum = parseEpisodeId(episodeId);

  // If requested number is >= next number, it hasn't been allocated yet
  // Otherwise, it was allocated and is reserved (must rollback to reuse)
  return requestedNum >= state.nextEpisodeNumber;
}

/**
 * Reserve a specific episode ID (for override scenarios).
 * Updates the counter if the ID is higher than current next.
 *
 * @param episodeId - The episode ID to reserve
 * @param filePath - State file path
 */
export function reserveEpisodeId(
  episodeId: EpisodeId,
  filePath: string = DEFAULT_STATE_FILE,
): void {
  const state = loadPodcastState(filePath);
  const num = parseEpisodeId(episodeId);

  // Update counter if this ID is >= current next
  if (num >= state.nextEpisodeNumber) {
    state.nextEpisodeNumber = num + 1;
  }

  state.lastAllocatedId = episodeId;
  state.updatedAt = new Date().toISOString();
  savePodcastState(state, filePath);
}

/**
 * Rollback allocated episode ID on failure.
 * Only call if Notion creation fails immediately after allocation.
 *
 * Safety: Only rolls back if this was the last allocated ID and
 * the counter is exactly one ahead (preventing out-of-order rollbacks).
 */
export function rollbackEpisodeId(
  episodeId: EpisodeId,
  filePath: string = DEFAULT_STATE_FILE,
): boolean {
  const state = loadPodcastState(filePath);

  // Only rollback if this was the last allocated ID
  if (state.lastAllocatedId === episodeId) {
    const num = parseEpisodeId(episodeId);
    if (state.nextEpisodeNumber === num + 1) {
      state.nextEpisodeNumber = num;
      state.lastAllocatedId = undefined;
      state.updatedAt = new Date().toISOString();
      savePodcastState(state, filePath);
      return true;
    }
  }
  return false;
}

/**
 * Get current state (for debugging/status).
 */
export function getPodcastState(filePath: string = DEFAULT_STATE_FILE): PodcastState {
  return loadPodcastState(filePath);
}

/**
 * Get the next episode ID without allocating it.
 */
export function peekNextEpisodeId(filePath: string = DEFAULT_STATE_FILE): EpisodeId {
  const state = loadPodcastState(filePath);
  return formatEpisodeId(state.nextEpisodeNumber);
}

/**
 * Get the most recently allocated episode ID.
 * Returns null if no episodes have been allocated.
 */
export function getLastAllocatedId(filePath: string = DEFAULT_STATE_FILE): EpisodeId | null {
  const state = loadPodcastState(filePath);
  if (state.nextEpisodeNumber <= 1) {
    return null;
  }
  return state.lastAllocatedId ?? formatEpisodeId(state.nextEpisodeNumber - 1);
}

/**
 * Reset state (for testing only).
 */
export function resetPodcastState(filePath: string = DEFAULT_STATE_FILE): void {
  const state: PodcastState = {
    nextEpisodeNumber: 1,
    updatedAt: new Date().toISOString(),
  };
  savePodcastState(state, filePath);
}
