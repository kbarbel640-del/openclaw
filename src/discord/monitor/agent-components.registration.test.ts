import { describe, expect, it } from "vitest";
import { parseDiscordComponentCustomIdForCarbon } from "../components.js";
import {
  createDiscordComponentButton,
  createDiscordComponentChannelSelect,
  createDiscordComponentMentionableSelect,
  createDiscordComponentRoleSelect,
  createDiscordComponentStringSelect,
  createDiscordComponentUserSelect,
} from "./agent-components.js";

const ctx = {
  cfg: {},
  discordConfig: {},
  accountId: "default",
  guildEntries: new Map(),
  runtime: {},
  token: "test",
} as any;

describe("discord component registration", () => {
  it("uses unique wildcard customIds so Carbon registers all component types", () => {
    const components = [
      createDiscordComponentButton(ctx),
      createDiscordComponentStringSelect(ctx),
      createDiscordComponentUserSelect(ctx),
      createDiscordComponentRoleSelect(ctx),
      createDiscordComponentMentionableSelect(ctx),
      createDiscordComponentChannelSelect(ctx),
    ];

    const ids = components.map((component) => component.customId);
    expect(new Set(ids).size).toBe(ids.length);

    for (const component of components) {
      expect(parseDiscordComponentCustomIdForCarbon(component.customId).key).toBe("*");
    }
  });
});
