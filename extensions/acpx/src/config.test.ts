import { describe, expect, it } from "vitest";
import { createAcpxPluginConfigSchema, resolveAcpxPluginConfig } from "./config.js";

describe("acpx plugin config parsing", () => {
  it("accepts and trims valid commandArgs entries", () => {
    const resolved = resolveAcpxPluginConfig({
      rawConfig: {
        commandArgs: ["  --foo  ", "--bar=baz"],
      },
      workspaceDir: "/tmp/workspace",
    });

    expect(resolved.commandArgs).toEqual(["--foo", "--bar=baz"]);
  });

  it("rejects commandArgs arrays containing non-string entries", () => {
    expect(() =>
      resolveAcpxPluginConfig({
        rawConfig: {
          commandArgs: ["--ok", 123],
        },
        workspaceDir: "/tmp/workspace",
      }),
    ).toThrow("commandArgs must be an array of strings");
  });

  it("rejects commandArgs arrays containing empty strings", () => {
    const schema = createAcpxPluginConfigSchema();
    const parsed = schema.safeParse({
      commandArgs: ["--ok", "   "],
    });

    expect(parsed.success).toBe(false);
  });
});
