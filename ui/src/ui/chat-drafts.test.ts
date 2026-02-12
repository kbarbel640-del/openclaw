import { afterEach, describe, expect, it } from "vitest";
import {
  loadChatComposerState,
  loadChatDraft,
  saveChatComposerState,
  saveChatDraft,
} from "./chat-drafts.ts";

const STORAGE_KEY = "openclaw.control.chat-drafts.v1";

describe("chat-drafts", () => {
  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it("persists and restores draft by session key", () => {
    saveChatDraft("agent:main:main", "## Problem Statement\n- Problem: test");

    expect(loadChatDraft("agent:main:main")).toContain("Problem Statement");
    expect(loadChatDraft("agent:other:main")).toBe("");
  });

  it("clears stored draft when message is empty", () => {
    saveChatDraft("main", "Some draft");
    expect(loadChatDraft("main")).toBe("Some draft");

    saveChatDraft("main", "   ");
    expect(loadChatDraft("main")).toBe("");
  });

  it("persists and restores attachments per session", () => {
    saveChatComposerState("agent:main:main", {
      draft: "with image",
      attachments: [{ id: "a1", mimeType: "image/png", dataUrl: "data:image/png;base64,abc123" }],
    });
    const composer = loadChatComposerState("agent:main:main");
    expect(composer.draft).toBe("with image");
    expect(composer.attachments).toHaveLength(1);
    expect(composer.attachments[0]?.id).toBe("a1");
  });

  it("saveChatDraft preserves existing attachments", () => {
    saveChatComposerState("main", {
      draft: "seed",
      attachments: [{ id: "a1", mimeType: "image/png", dataUrl: "data:image/png;base64,abc123" }],
    });
    saveChatDraft("main", "updated text");
    const composer = loadChatComposerState("main");
    expect(composer.draft).toBe("updated text");
    expect(composer.attachments).toHaveLength(1);
  });
});
