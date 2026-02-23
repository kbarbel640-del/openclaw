import { describe, expect, it } from "vitest";
import {
  TelegramAccountSchema,
  TelegramConfigSchema,
  SignalAccountSchema,
  SignalConfigSchema,
  IrcAccountSchema,
  IrcConfigSchema,
  IMessageAccountSchema,
  IMessageConfigSchema,
  BlueBubblesAccountSchema,
  BlueBubblesConfigSchema,
} from "./zod-schema.providers-core.js";

/**
 * Account schemas must NOT inject Zod .default() values for policy fields
 * (dmPolicy, groupPolicy) so that the account resolution functions can
 * correctly fall back to channel-level settings via nullish coalescing.
 *
 * Config (root) schemas SHOULD keep their defaults as sensible fallbacks.
 */

describe.each([
  { name: "Telegram", accountSchema: TelegramAccountSchema, configSchema: TelegramConfigSchema },
  { name: "Signal", accountSchema: SignalAccountSchema, configSchema: SignalConfigSchema },
  { name: "IRC", accountSchema: IrcAccountSchema, configSchema: IrcConfigSchema },
  { name: "iMessage", accountSchema: IMessageAccountSchema, configSchema: IMessageConfigSchema },
  {
    name: "BlueBubbles",
    accountSchema: BlueBubblesAccountSchema,
    configSchema: BlueBubblesConfigSchema,
  },
])("$name account schema policy defaults", ({ accountSchema, configSchema }) => {
  it("does not inject dmPolicy default at account level", () => {
    const result = accountSchema.parse({});
    expect(result.dmPolicy).toBeUndefined();
  });

  it("does not inject groupPolicy default at account level", () => {
    const result = accountSchema.parse({});
    expect(result.groupPolicy).toBeUndefined();
  });

  it("preserves explicitly set account-level dmPolicy", () => {
    const result = accountSchema.parse({ dmPolicy: "disabled" });
    expect(result.dmPolicy).toBe("disabled");
  });

  it("applies dmPolicy default at the root config level", () => {
    const result = configSchema.parse({});
    expect(result.dmPolicy).toBe("pairing");
  });

  it("applies groupPolicy default at the root config level", () => {
    const result = configSchema.parse({});
    expect(result.groupPolicy).toBe("allowlist");
  });
});
