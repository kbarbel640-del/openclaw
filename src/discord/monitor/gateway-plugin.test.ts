import { GatewayIntents } from "@buape/carbon/gateway";
import { describe, expect, it } from "vitest";
import { resolveDiscordGatewayIntents } from "./gateway-plugin.js";

describe("resolveDiscordGatewayIntents", () => {
  it("includes the default Discord gateway intents", () => {
    const intents = resolveDiscordGatewayIntents();

    expect(intents & GatewayIntents.Guilds).toBeTruthy();
    expect(intents & GatewayIntents.GuildMessages).toBeTruthy();
    expect(intents & GatewayIntents.MessageContent).toBeTruthy();
    expect(intents & GatewayIntents.DirectMessages).toBeTruthy();
    expect(intents & GatewayIntents.GuildMessageReactions).toBeTruthy();
    expect(intents & GatewayIntents.DirectMessageReactions).toBeTruthy();
  });

  it("does not include guild voice states by default", () => {
    const intents = resolveDiscordGatewayIntents();

    expect(intents & GatewayIntents.GuildVoiceStates).toBe(0);
  });

  it("adds guild voice states when enabled", () => {
    const intents = resolveDiscordGatewayIntents({ guildVoiceStates: true });

    expect(intents & GatewayIntents.GuildVoiceStates).toBe(GatewayIntents.GuildVoiceStates);
  });

  it("combines presence and guild voice states", () => {
    const intents = resolveDiscordGatewayIntents({
      presence: true,
      guildVoiceStates: true,
    });

    expect(intents & GatewayIntents.GuildPresences).toBe(GatewayIntents.GuildPresences);
    expect(intents & GatewayIntents.GuildVoiceStates).toBe(GatewayIntents.GuildVoiceStates);
  });

  it("combines guild members and guild voice states", () => {
    const intents = resolveDiscordGatewayIntents({
      guildMembers: true,
      guildVoiceStates: true,
    });

    expect(intents & GatewayIntents.GuildMembers).toBe(GatewayIntents.GuildMembers);
    expect(intents & GatewayIntents.GuildVoiceStates).toBe(GatewayIntents.GuildVoiceStates);
  });
});
