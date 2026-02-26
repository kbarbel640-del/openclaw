import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import type { SessionEntry } from "../config/sessions.js";
import { resolveSendPolicy } from "./send-policy.js";

describe("resolveSendPolicy", () => {
  it("defaults to allow", () => {
    const cfg = {} as OpenClawConfig;
    expect(resolveSendPolicy({ cfg })).toBe("allow");
  });

  it("entry override wins", () => {
    const cfg = {
      session: { sendPolicy: { default: "allow" } },
    } as OpenClawConfig;
    const entry: SessionEntry = {
      sessionId: "s",
      updatedAt: 0,
      sendPolicy: "deny",
    };
    expect(resolveSendPolicy({ cfg, entry })).toBe("deny");
  });

  it("rule match by channel + chatType", () => {
    const cfg = {
      session: {
        sendPolicy: {
          default: "allow",
          rules: [
            {
              action: "deny",
              match: { channel: "discord", chatType: "group" },
            },
          ],
        },
      },
    } as OpenClawConfig;
    const entry: SessionEntry = {
      sessionId: "s",
      updatedAt: 0,
      channel: "discord",
      chatType: "group",
    };
    expect(resolveSendPolicy({ cfg, entry, sessionKey: "discord:group:dev" })).toBe("deny");
  });

  it("rule match by keyPrefix", () => {
    const cfg = {
      session: {
        sendPolicy: {
          default: "allow",
          rules: [{ action: "deny", match: { keyPrefix: "cron:" } }],
        },
      },
    } as OpenClawConfig;
    expect(resolveSendPolicy({ cfg, sessionKey: "cron:job-1" })).toBe("deny");
  });

  it("rule match by rawKeyPrefix", () => {
    const cfg = {
      session: {
        sendPolicy: {
          default: "allow",
          rules: [{ action: "deny", match: { rawKeyPrefix: "agent:main:discord:" } }],
        },
      },
    } as OpenClawConfig;
    expect(resolveSendPolicy({ cfg, sessionKey: "agent:main:discord:group:dev" })).toBe("deny");
    expect(resolveSendPolicy({ cfg, sessionKey: "agent:main:slack:group:dev" })).toBe("allow");
  });

  it("derives channel from new session key format with accountId", () => {
    const cfg = {
      session: {
        sendPolicy: {
          default: "allow",
          rules: [{ action: "deny", match: { channel: "discord" } }],
        },
      },
    } as OpenClawConfig;
    // New format: agent:<agentId>:<channel>:<accountId>:<peerKind>:<peerId>
    expect(resolveSendPolicy({ cfg, sessionKey: "agent:main:discord:acc-1:channel:123" })).toBe(
      "deny",
    );
    expect(resolveSendPolicy({ cfg, sessionKey: "agent:main:discord:acc-1:group:456" })).toBe(
      "deny",
    );
    // Old format should still work
    expect(resolveSendPolicy({ cfg, sessionKey: "agent:main:discord:channel:123" })).toBe("deny");
    expect(resolveSendPolicy({ cfg, sessionKey: "agent:main:discord:group:456" })).toBe("deny");
  });
});
