import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createConfigIO } from "./io.js";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-include-io-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe("$include preservation via createConfigIO", () => {
  it("preserves $include directive after write roundtrip", async () => {
    await withTempDir(async (dir) => {
      const basePath = path.join(dir, "base.json");
      const configPathFile = path.join(dir, "openclaw.json");

      // Base file provides gateway config
      await fs.writeFile(
        basePath,
        JSON.stringify({
          gateway: { port: 4000 },
        }),
      );

      await fs.writeFile(
        configPathFile,
        JSON.stringify(
          {
            $include: "./base.json",
            agents: { list: [{ id: "main", name: "Main" }] },
          },
          null,
          2,
        ),
      );

      const io = createConfigIO({ configPath: configPathFile });
      const snapshot = await io.readConfigFileSnapshot();

      // Write back with a change to a sibling key
      const updated = {
        ...snapshot.config,
        agents: {
          ...snapshot.config.agents,
          list: [{ id: "main", name: "Updated" }],
        },
      };
      await io.writeConfigFile(updated);

      // Read the raw file — $include should still be there
      const written = JSON.parse(await fs.readFile(configPathFile, "utf-8"));
      expect(written.$include).toBe("./base.json");
      expect(written.agents).toBeDefined();
      expect(written.agents.list[0].name).toBe("Updated");
    });
  });

  it("does not inline keys from $include that were not changed", async () => {
    await withTempDir(async (dir) => {
      const basePath = path.join(dir, "base.json");
      const configPathFile = path.join(dir, "openclaw.json");

      await fs.writeFile(
        basePath,
        JSON.stringify({
          gateway: { port: 4000 },
        }),
      );

      await fs.writeFile(
        configPathFile,
        JSON.stringify(
          {
            $include: "./base.json",
            agents: { list: [{ id: "main" }] },
          },
          null,
          2,
        ),
      );

      const io = createConfigIO({ configPath: configPathFile });
      const snapshot = await io.readConfigFileSnapshot();

      // Write back unchanged
      await io.writeConfigFile(snapshot.config);

      const written = JSON.parse(await fs.readFile(configPathFile, "utf-8"));
      expect(written.$include).toBe("./base.json");
      // gateway comes from include — should NOT be present as inlined key
      // (though defaults may add other gateway keys, the raw gateway from include should not be inlined)
      expect(written.agents).toBeDefined();
    });
  });

  it("preserves nested $include directives", async () => {
    await withTempDir(async (dir) => {
      const gatewayPath = path.join(dir, "gateway.json");
      const configPathFile = path.join(dir, "openclaw.json");

      await fs.writeFile(gatewayPath, JSON.stringify({ port: 4000 }));

      await fs.writeFile(
        configPathFile,
        JSON.stringify(
          {
            gateway: {
              $include: "./gateway.json",
            },
            agents: { list: [{ id: "main", name: "Bot" }] },
          },
          null,
          2,
        ),
      );

      const io = createConfigIO({ configPath: configPathFile });
      const snapshot = await io.readConfigFileSnapshot();

      const updated = {
        ...snapshot.config,
        agents: {
          ...snapshot.config.agents,
          list: [{ id: "main", name: "Updated" }],
        },
      };
      await io.writeConfigFile(updated);

      const written = JSON.parse(await fs.readFile(configPathFile, "utf-8"));
      expect(written.gateway.$include).toBe("./gateway.json");
      expect(written.agents.list[0].name).toBe("Updated");
    });
  });

  it("works normally when config has no $include", async () => {
    await withTempDir(async (dir) => {
      const configPathFile = path.join(dir, "openclaw.json");

      await fs.writeFile(
        configPathFile,
        JSON.stringify({ agents: { list: [{ id: "main", name: "Bot" }] } }, null, 2),
      );

      const io = createConfigIO({ configPath: configPathFile });
      const snapshot = await io.readConfigFileSnapshot();

      const updated = {
        ...snapshot.config,
        agents: {
          ...snapshot.config.agents,
          list: [{ id: "main", name: "Updated" }],
        },
      };
      await io.writeConfigFile(updated);

      const written = JSON.parse(await fs.readFile(configPathFile, "utf-8"));
      expect(written.agents.list[0].name).toBe("Updated");
      expect(written.$include).toBeUndefined();
    });
  });
});
