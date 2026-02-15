import { atom, computed } from "nanostores";
import type { ChatQueueItem, ChatAttachment } from "../ui/ui-types.ts";

// Chat state
export const $chatLoading = atom(false);
export const $chatSending = atom(false);
export const $chatMessage = atom("");
export const $chatMessages = atom<unknown[]>([]);
export const $chatToolMessages = atom<unknown[]>([]);
export const $chatStream = atom<string | null>(null);
export const $chatStreamStartedAt = atom<number | null>(null);
export const $chatRunId = atom<string | null>(null);
export const $chatAvatarUrl = atom<string | null>(null);
export const $chatThinkingLevel = atom<string | null>(null);
export const $chatQueue = atom<ChatQueueItem[]>([]);
export const $chatAttachments = atom<ChatAttachment[]>([]);

// Sidebar state for tool output viewing
export const $sidebarOpen = atom(false);
export const $sidebarContent = atom<string | null>(null);
export const $sidebarError = atom<string | null>(null);
export const $splitRatio = atom(0.5);

// Derived state
export const $isChatBusy = computed(
  [$chatLoading, $chatSending],
  (loading, sending) => loading || sending,
);

export const $hasMessages = computed($chatMessages, (messages) => messages.length > 0);

export const $isStreaming = computed($chatStream, (stream) => stream !== null);
