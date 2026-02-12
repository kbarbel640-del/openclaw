import type { ChatAttachment } from "./ui-types.ts";

const STORAGE_KEY = "openclaw.control.chat-drafts.v1";
const MAX_ENTRIES = 120;
const MAX_DRAFT_LENGTH = 20_000;
const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_DATA_URL_LENGTH = 700_000;
const MAX_TOTAL_ATTACHMENT_CHARS = 2_000_000;

type ChatDraftEntry = {
  draft: string;
  attachments: ChatAttachment[];
  updatedAt: number;
};

type ChatDraftStore = Record<string, ChatDraftEntry>;

function normalizeSessionKey(raw: string): string {
  return raw.trim();
}

function loadStore(): ChatDraftStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, Partial<ChatDraftEntry>>;
    const next: ChatDraftStore = {};
    for (const [key, value] of Object.entries(parsed ?? {})) {
      const sessionKey = normalizeSessionKey(key);
      if (!sessionKey || !value || typeof value !== "object") {
        continue;
      }
      const draft = typeof value.draft === "string" ? value.draft : "";
      const attachments = sanitizeAttachments(
        Array.isArray((value as { attachments?: unknown[] }).attachments)
          ? ((value as { attachments?: unknown[] }).attachments as unknown[])
          : [],
      );
      const updatedAt =
        typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
          ? value.updatedAt
          : 0;
      if (!draft.trim() && attachments.length === 0) {
        continue;
      }
      next[sessionKey] = {
        draft: draft.slice(0, MAX_DRAFT_LENGTH),
        attachments,
        updatedAt,
      };
    }
    return next;
  } catch {
    return {};
  }
}

function sanitizeAttachments(raw: unknown[]): ChatAttachment[] {
  const clean: ChatAttachment[] = [];
  let totalChars = 0;
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id.trim() : "";
    const dataUrl = typeof rec.dataUrl === "string" ? rec.dataUrl : "";
    const mimeType = typeof rec.mimeType === "string" ? rec.mimeType.trim() : "";
    if (!id || !dataUrl || !mimeType) {
      continue;
    }
    if (dataUrl.length > MAX_ATTACHMENT_DATA_URL_LENGTH) {
      continue;
    }
    totalChars += dataUrl.length;
    if (totalChars > MAX_TOTAL_ATTACHMENT_CHARS) {
      break;
    }
    clean.push({ id, dataUrl, mimeType });
    if (clean.length >= MAX_ATTACHMENTS) {
      break;
    }
  }
  return clean;
}

function saveStore(store: ChatDraftStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore localStorage failures.
  }
}

function pruneStore(store: ChatDraftStore): ChatDraftStore {
  const entries = Object.entries(store);
  if (entries.length <= MAX_ENTRIES) {
    return store;
  }
  const sorted = entries.toSorted((a, b) => (b[1]?.updatedAt ?? 0) - (a[1]?.updatedAt ?? 0));
  const limited: ChatDraftStore = {};
  for (const [key, value] of sorted.slice(0, MAX_ENTRIES)) {
    limited[key] = value;
  }
  return limited;
}

export function loadChatDraft(sessionKey: string): string {
  const normalized = normalizeSessionKey(sessionKey);
  if (!normalized) {
    return "";
  }
  const store = loadStore();
  return store[normalized]?.draft ?? "";
}

export function saveChatDraft(sessionKey: string, draft: string): void {
  const current = loadChatComposerState(sessionKey);
  saveChatComposerState(sessionKey, { draft, attachments: current.attachments });
}

export function loadChatComposerState(sessionKey: string): {
  draft: string;
  attachments: ChatAttachment[];
} {
  const normalized = normalizeSessionKey(sessionKey);
  if (!normalized) {
    return { draft: "", attachments: [] };
  }
  const store = loadStore();
  const entry = store[normalized];
  return {
    draft: entry?.draft ?? "",
    attachments: entry?.attachments ?? [],
  };
}

export function saveChatComposerState(
  sessionKey: string,
  state: { draft: string; attachments?: ChatAttachment[] },
): void {
  const normalized = normalizeSessionKey(sessionKey);
  if (!normalized) {
    return;
  }
  const store = loadStore();
  const trimmed = state.draft.trim();
  const attachments = sanitizeAttachments((state.attachments ?? []) as unknown[]);
  if (!trimmed && attachments.length === 0) {
    if (store[normalized]) {
      delete store[normalized];
      saveStore(store);
    }
    return;
  }
  store[normalized] = {
    draft: state.draft.slice(0, MAX_DRAFT_LENGTH),
    attachments,
    updatedAt: Date.now(),
  };
  saveStore(pruneStore(store));
}
