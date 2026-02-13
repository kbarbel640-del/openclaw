import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import type { TemplateContext } from "../templating.js";
import { buildThreadingToolContext, resolveEnforceFinalTag } from "./agent-runner-utils.js";

describe("buildThreadingToolContext", () => {
  const cfg = {} as OpenClawConfig;

  it("uses conversation id for WhatsApp", () => {
    const sessionCtx = {
      Provider: "whatsapp",
      From: "123@g.us",
      To: "+15550001",
    } as TemplateContext;

    const result = buildThreadingToolContext({
      sessionCtx,
      config: cfg,
      hasRepliedRef: undefined,
    });

    expect(result.currentChannelId).toBe("123@g.us");
  });

  it("falls back to To for WhatsApp when From is missing", () => {
    const sessionCtx = {
      Provider: "whatsapp",
      To: "+15550001",
    } as TemplateContext;

    const result = buildThreadingToolContext({
      sessionCtx,
      config: cfg,
      hasRepliedRef: undefined,
    });

    expect(result.currentChannelId).toBe("+15550001");
  });

  it("uses the recipient id for other channels", () => {
    const sessionCtx = {
      Provider: "telegram",
      From: "user:42",
      To: "chat:99",
    } as TemplateContext;

    const result = buildThreadingToolContext({
      sessionCtx,
      config: cfg,
      hasRepliedRef: undefined,
    });

    expect(result.currentChannelId).toBe("chat:99");
  });

  it("uses the sender handle for iMessage direct chats", () => {
    const sessionCtx = {
      Provider: "imessage",
      ChatType: "direct",
      From: "imessage:+15550001",
      To: "chat_id:12",
    } as TemplateContext;

    const result = buildThreadingToolContext({
      sessionCtx,
      config: cfg,
      hasRepliedRef: undefined,
    });

    expect(result.currentChannelId).toBe("imessage:+15550001");
  });

  it("uses chat_id for iMessage groups", () => {
    const sessionCtx = {
      Provider: "imessage",
      ChatType: "group",
      From: "imessage:group:7",
      To: "chat_id:7",
    } as TemplateContext;

    const result = buildThreadingToolContext({
      sessionCtx,
      config: cfg,
      hasRepliedRef: undefined,
    });

    expect(result.currentChannelId).toBe("chat_id:7");
  });

  it("prefers MessageThreadId for Slack tool threading", () => {
    const sessionCtx = {
      Provider: "slack",
      To: "channel:C1",
      MessageThreadId: "123.456",
    } as TemplateContext;

    const result = buildThreadingToolContext({
      sessionCtx,
      config: { channels: { slack: { replyToMode: "all" } } } as OpenClawConfig,
      hasRepliedRef: undefined,
    });

    expect(result.currentChannelId).toBe("C1");
    expect(result.currentThreadTs).toBe("123.456");
  });
});

describe("resolveEnforceFinalTag", () => {
  const baseRun = {} as { enforceFinalTag?: boolean };

  it("does not force final tags for google-gemini-cli by default", () => {
    expect(
      resolveEnforceFinalTag(
        baseRun as Parameters<typeof resolveEnforceFinalTag>[0],
        "google-gemini-cli",
      ),
    ).toBe(false);
  });

  it("does not force final tags for google-generative-ai by default", () => {
    expect(
      resolveEnforceFinalTag(
        baseRun as Parameters<typeof resolveEnforceFinalTag>[0],
        "google-generative-ai",
      ),
    ).toBe(false);
  });

  it("keeps forcing final tags for google-antigravity", () => {
    expect(
      resolveEnforceFinalTag(
        baseRun as Parameters<typeof resolveEnforceFinalTag>[0],
        "google-antigravity",
      ),
    ).toBe(true);
  });

  it("honors explicit run.enforceFinalTag for google-gemini-cli", () => {
    expect(
      resolveEnforceFinalTag(
        { enforceFinalTag: true } as Parameters<typeof resolveEnforceFinalTag>[0],
        "google-gemini-cli",
      ),
    ).toBe(true);
  });
});
