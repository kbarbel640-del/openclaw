import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import type { AuthProfileStore } from "./auth-profiles.js";
import { resolveAuthProfileOrder } from "./auth-profiles.js";

describe("resolveAuthProfileOrder with accountTags", () => {
  const store: AuthProfileStore = {
    version: 1,
    profiles: {
      "google-antigravity:sendtelecom@gmail.com": {
        type: "oauth",
        provider: "google-antigravity",
        access: "token-sendtelecom",
        refresh: "refresh-sendtelecom",
        expires: Date.now() + 60_000,
      },
      "google-antigravity:julio@gmail.com": {
        type: "oauth",
        provider: "google-antigravity",
        access: "token-julio",
        refresh: "refresh-julio",
        expires: Date.now() + 60_000,
      },
      "google-antigravity:douglas@gmail.com": {
        type: "oauth",
        provider: "google-antigravity",
        access: "token-douglas",
        refresh: "refresh-douglas",
        expires: Date.now() + 60_000,
      },
    },
  };

  const cfg: OpenClawConfig = {
    auth: {
      profiles: {
        "google-antigravity:sendtelecom@gmail.com": {
          provider: "google-antigravity",
          mode: "oauth",
        },
        "google-antigravity:julio@gmail.com": {
          provider: "google-antigravity",
          mode: "oauth",
        },
        "google-antigravity:douglas@gmail.com": {
          provider: "google-antigravity",
          mode: "oauth",
        },
      },
      accountTags: {
        "google-antigravity": {
          sendtelecom: "google-antigravity:sendtelecom@gmail.com",
          julio: "google-antigravity:julio@gmail.com",
          douglas: "google-antigravity:douglas@gmail.com",
          main: "google-antigravity:sendtelecom@gmail.com",
        },
      },
    },
  };

  it("resolves valid accountTag to correct profile", () => {
    const order = resolveAuthProfileOrder({
      cfg,
      store,
      provider: "google-antigravity",
      accountTag: "sendtelecom",
    });

    // Should prioritize sendtelecom profile, with others as fallback
    expect(order[0]).toBe("google-antigravity:sendtelecom@gmail.com");
    expect(order).toContain("google-antigravity:julio@gmail.com");
    expect(order).toContain("google-antigravity:douglas@gmail.com");
  });

  it("resolves tag alias to correct profile", () => {
    const order = resolveAuthProfileOrder({
      cfg,
      store,
      provider: "google-antigravity",
      accountTag: "main",
    });

    // "main" is an alias for "sendtelecom"
    expect(order[0]).toBe("google-antigravity:sendtelecom@gmail.com");
  });

  it("throws error for invalid accountTag", () => {
    expect(() => {
      resolveAuthProfileOrder({
        cfg,
        store,
        provider: "google-antigravity",
        accountTag: "invalid-tag",
      });
    }).toThrow(/Account tag "@invalid-tag" not found/);
  });

  it("includes available tags in error message", () => {
    try {
      resolveAuthProfileOrder({
        cfg,
        store,
        provider: "google-antigravity",
        accountTag: "nonexistent",
      });
      expect.fail("Should have thrown error");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain("sendtelecom");
      expect(message).toContain("julio");
      expect(message).toContain("douglas");
      expect(message).toContain("main");
    }
  });

  it("throws error when tag points to non-existent profile", () => {
    const badCfg: OpenClawConfig = {
      auth: {
        accountTags: {
          "google-antigravity": {
            ghost: "google-antigravity:nonexistent@gmail.com",
          },
        },
      },
    };

    expect(() => {
      resolveAuthProfileOrder({
        cfg: badCfg,
        store,
        provider: "google-antigravity",
        accountTag: "ghost",
      });
    }).toThrow(/not found in store/);
  });

  it("throws error when tag profile has wrong provider", () => {
    const mixedStore: AuthProfileStore = {
      version: 1,
      profiles: {
        ...store.profiles,
        "anthropic:default": {
          type: "oauth",
          provider: "anthropic",
          access: "token-anthropic",
          refresh: "refresh-anthropic",
          expires: Date.now() + 60_000,
        },
      },
    };

    const badCfg: OpenClawConfig = {
      auth: {
        profiles: {
          "anthropic:default": {
            provider: "anthropic",
            mode: "oauth",
          },
        },
        accountTags: {
          "google-antigravity": {
            wrong: "anthropic:default",
          },
        },
      },
    };

    expect(() => {
      resolveAuthProfileOrder({
        cfg: badCfg,
        store: mixedStore,
        provider: "google-antigravity",
        accountTag: "wrong",
      });
    }).toThrow(/has provider "anthropic" but expected "google-antigravity"/);
  });

  it("works without accountTag (backward compatible)", () => {
    const order = resolveAuthProfileOrder({
      cfg,
      store,
      provider: "google-antigravity",
    });

    // Should work normally without accountTag
    expect(order.length).toBe(3);
    expect(order).toContain("google-antigravity:sendtelecom@gmail.com");
    expect(order).toContain("google-antigravity:julio@gmail.com");
    expect(order).toContain("google-antigravity:douglas@gmail.com");
  });

  it("accountTag takes precedence over preferredProfile", () => {
    const order = resolveAuthProfileOrder({
      cfg,
      store,
      provider: "google-antigravity",
      preferredProfile: "google-antigravity:douglas@gmail.com",
      accountTag: "julio",
    });

    // accountTag should win
    expect(order[0]).toBe("google-antigravity:julio@gmail.com");
  });

  it("handles provider with no configured tags", () => {
    expect(() => {
      resolveAuthProfileOrder({
        cfg,
        store,
        provider: "google-antigravity",
        accountTag: "sometag",
      });
    }).toThrow(/Available tags: sendtelecom, julio, douglas, main/);
  });

  it("handles provider with empty tag map", () => {
    const cfgEmptyTags: OpenClawConfig = {
      auth: {
        accountTags: {
          "google-antigravity": {},
        },
      },
    };

    expect(() => {
      resolveAuthProfileOrder({
        cfg: cfgEmptyTags,
        store,
        provider: "google-antigravity",
        accountTag: "anytag",
      });
    }).toThrow(/No tags configured for this provider/);
  });

  it("normalizes provider name when looking up tags", () => {
    const order = resolveAuthProfileOrder({
      cfg,
      store,
      provider: "Google-Antigravity", // Different casing
      accountTag: "sendtelecom",
    });

    expect(order[0]).toBe("google-antigravity:sendtelecom@gmail.com");
  });
});
