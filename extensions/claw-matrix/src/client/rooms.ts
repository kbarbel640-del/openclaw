import type { MatrixEvent } from "../types.js";

/**
 * In-memory room state tracker.
 *
 * Tracks:
 * - Encryption state per room (write-once: once true, never false per spec §11.12)
 * - Room type (dm vs group based on member count)
 * - Room display names
 * - Room membership
 */

// Encryption state — write-once per spec
const encryptionCache = new Map<string, boolean>();

// Room type tracking
const roomTypeCache = new Map<string, "dm" | "group">();

// Room display names
const roomNameCache = new Map<string, string>();

// Room members: roomId → Set of userIds
const roomMembersCache = new Map<string, Set<string>>();

/**
 * Check if a room has encryption enabled.
 */
export function isRoomEncrypted(roomId: string): boolean {
  return encryptionCache.get(roomId) === true;
}

/**
 * Mark a room as encrypted (write-once).
 */
export function setRoomEncrypted(roomId: string): void {
  encryptionCache.set(roomId, true);
}

/**
 * Check if a room is a DM.
 */
export function isDmRoom(roomId: string): boolean {
  return roomTypeCache.get(roomId) === "dm";
}

/**
 * Get room display name.
 */
export function getRoomName(roomId: string): string | undefined {
  return roomNameCache.get(roomId);
}

/**
 * Get room members.
 */
export function getRoomMembers(roomId: string): Set<string> {
  return roomMembersCache.get(roomId) ?? new Set();
}

/**
 * Process state events from a sync response for a room.
 */
export function processStateEvents(
  roomId: string,
  events: MatrixEvent[]
): void {
  for (const event of events) {
    switch (event.type) {
      case "m.room.encryption":
        // Write-once: once encrypted, always encrypted
        setRoomEncrypted(roomId);
        break;

      case "m.room.name":
        if (typeof event.content?.name === "string") {
          roomNameCache.set(roomId, event.content.name);
        }
        break;

      case "m.room.member": {
        const userId = event.state_key;
        if (!userId) break;

        let members = roomMembersCache.get(roomId);
        if (!members) {
          members = new Set();
          roomMembersCache.set(roomId, members);
        }

        const membership = event.content?.membership;
        if (membership === "join") {
          members.add(userId);
        } else if (membership === "leave" || membership === "ban") {
          // Note: "kick" is not a Matrix membership value.
          // Kicked users have membership "leave" with a different sender.
          members.delete(userId);
        }

        // Update room type based on member count
        // DM = exactly 2 members (or 1 if other left)
        roomTypeCache.set(roomId, members.size <= 2 ? "dm" : "group");
        break;
      }
    }
  }
}

/**
 * Clean up state for a room we've left.
 *
 * NOTE: encryptionCache is NOT cleared — write-once per spec §11.12.
 * If we rejoin the room before re-receiving m.room.encryption state,
 * we must still know it's encrypted to avoid sending plaintext.
 */
export function cleanupRoom(roomId: string): void {
  // encryptionCache intentionally preserved (write-once)
  roomTypeCache.delete(roomId);
  roomNameCache.delete(roomId);
  roomMembersCache.delete(roomId);
}

/**
 * Get all tracked room IDs.
 */
export function getTrackedRoomIds(): string[] {
  return [...new Set([
    ...encryptionCache.keys(),
    ...roomTypeCache.keys(),
  ])];
}
