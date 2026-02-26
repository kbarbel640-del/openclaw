import { describe, expect, it } from "vitest";
import { validateConfigObject } from "./config.js";

function expectValidConfig(result: ReturnType<typeof validateConfigObject>) {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected config to be valid");
  }
  return result.config;
}

describe("config signal groups", () => {
  it("accepts channels.signal.groups requireMention overrides", () => {
    const res = validateConfigObject({
      channels: {
        signal: {
          groups: {
            "*": { requireMention: false },
            "group:abc123": { requireMention: true },
          },
        },
      },
    });

    const config = expectValidConfig(res);
    expect(config.channels?.signal?.groups?.["*"]?.requireMention).toBe(false);
    expect(config.channels?.signal?.groups?.["group:abc123"]?.requireMention).toBe(true);
  });

  it("accepts channels.signal.accounts.*.groups overrides", () => {
    const res = validateConfigObject({
      channels: {
        signal: {
          accounts: {
            personal: {
              account: "+15550001111",
              groups: {
                "*": { requireMention: false },
              },
            },
          },
        },
      },
    });

    const config = expectValidConfig(res);
    expect(config.channels?.signal?.accounts?.personal?.groups?.["*"]?.requireMention).toBe(false);
  });
});
