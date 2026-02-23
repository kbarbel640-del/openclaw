import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { addGatewayClientOptions } from "./gateway-rpc.js";

describe("browser CLI --browser-profile flag", () => {
  it("parses --browser-profile from parent command options", () => {
    const program = new Command();
    program.name("test");

    const browser = program
      .command("browser")
      .option("--browser-profile <name>", "Browser profile name");

    let capturedProfile: string | undefined;

    browser.command("status").action((_opts, cmd) => {
      const parent = cmd.parent?.opts?.() as { browserProfile?: string };
      capturedProfile = parent?.browserProfile;
    });

    program.parse(["node", "test", "browser", "--browser-profile", "onasset", "status"]);

    expect(capturedProfile).toBe("onasset");
  });

  it("defaults to undefined when --browser-profile not provided", () => {
    const program = new Command();
    program.name("test");

    const browser = program
      .command("browser")
      .option("--browser-profile <name>", "Browser profile name");

    let capturedProfile: string | undefined = "should-be-undefined";

    browser.command("status").action((_opts, cmd) => {
      const parent = cmd.parent?.opts?.() as { browserProfile?: string };
      capturedProfile = parent?.browserProfile;
    });

    program.parse(["node", "test", "browser", "status"]);

    expect(capturedProfile).toBeUndefined();
  });

  it("does not conflict with global --profile flag", () => {
    // The global --profile flag is handled by /entry.js before Commander
    // This test verifies --browser-profile is a separate option
    const program = new Command();
    program.name("test");
    program.option("--profile <name>", "Global config profile");

    const browser = program
      .command("browser")
      .option("--browser-profile <name>", "Browser profile name");

    let globalProfile: string | undefined;
    let browserProfile: string | undefined;

    browser.command("status").action((_opts, cmd) => {
      const parent = cmd.parent?.opts?.() as { browserProfile?: string };
      browserProfile = parent?.browserProfile;
      globalProfile = program.opts().profile;
    });

    program.parse([
      "node",
      "test",
      "--profile",
      "dev",
      "browser",
      "--browser-profile",
      "onasset",
      "status",
    ]);

    expect(globalProfile).toBe("dev");
    expect(browserProfile).toBe("onasset");
  });
});

describe("browser CLI option collisions with gateway options", () => {
  it("cookies set --cookie-url does not collide with parent --url (gateway)", () => {
    // Regression test for #24811: --url on parent browser command (for gateway WebSocket)
    // was captured before the cookies set subcommand could see it
    const program = new Command();
    program.name("test");

    const browser = program
      .command("browser")
      .option("--browser-profile <name>", "Browser profile name");

    // Add the gateway client options (including --url) to the parent command
    addGatewayClientOptions(browser);

    const cookies = browser.command("cookies").description("Read/write cookies");

    let capturedCookieUrl: string | undefined;
    let capturedGatewayUrl: string | undefined;

    cookies
      .command("set")
      .argument("<name>", "Cookie name")
      .argument("<value>", "Cookie value")
      .requiredOption("--cookie-url <url>", "Cookie URL scope")
      .action((name: string, value: string, opts, cmd) => {
        capturedCookieUrl = opts.cookieUrl;
        // Walk up to browser command to get gateway --url
        const browserOpts = cmd.parent?.parent?.opts?.() as { url?: string };
        capturedGatewayUrl = browserOpts?.url;
      });

    program.parse([
      "node",
      "test",
      "browser",
      "--url",
      "ws://gateway:18789",
      "cookies",
      "set",
      "session",
      "abc123",
      "--cookie-url",
      "https://example.com",
    ]);

    expect(capturedCookieUrl).toBe("https://example.com");
    expect(capturedGatewayUrl).toBe("ws://gateway:18789");
  });
});
