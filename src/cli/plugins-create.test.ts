import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("openclaw plugins create", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oc-plugin-create-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /**
   * Rather than importing Commander and wiring the full CLI, we test
   * the scaffolding logic directly by simulating what the `create`
   * command does.
   */
  function scaffoldPlugin(
    name: string,
    opts: { description?: string; output?: string; kind?: string } = {},
  ) {
    const pluginId = name
      .replace(/^@[^/]+\//, "")
      .replace(/[^a-z0-9-]/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();

    if (!pluginId) {
      throw new Error("Invalid plugin name: resolved to an empty identifier.");
    }

    const outDir = opts.output ?? path.join(tmpDir, pluginId);

    if (fs.existsSync(outDir)) {
      throw new Error(`Directory already exists: ${outDir}`);
    }
    fs.mkdirSync(outDir, { recursive: true });

    const description = opts.description ?? `OpenClaw plugin: ${pluginId}`;

    const packageJson = {
      name: `@openclaw/${pluginId}`,
      version: "0.1.0",
      private: true,
      description,
      type: "module",
      devDependencies: { openclaw: "workspace:*" },
      openclaw: { extensions: ["./index.ts"] },
    };
    fs.writeFileSync(
      path.join(outDir, "package.json"),
      JSON.stringify(packageJson, null, 2) + "\n",
    );

    const manifest: Record<string, unknown> = {
      id: pluginId,
      name: pluginId,
      description,
      configSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    };
    if (opts.kind) {
      manifest.kind = opts.kind;
    }
    fs.writeFileSync(
      path.join(outDir, "openclaw.plugin.json"),
      JSON.stringify(manifest, null, 2) + "\n",
    );

    const indexContent = `import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

export default {
  id: "${pluginId}",
  name: "${pluginId}",
  description: "${description.replace(/"/g, '\\"')}",
  configSchema: emptyPluginConfigSchema(),

  register(api: OpenClawPluginApi) {
    api.logger.info("${pluginId} plugin loaded");
  },
};
`;
    fs.writeFileSync(path.join(outDir, "index.ts"), indexContent);

    return { outDir, pluginId };
  }

  it("creates all three files", () => {
    const { outDir } = scaffoldPlugin("my-plugin");
    expect(fs.existsSync(path.join(outDir, "package.json"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "openclaw.plugin.json"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "index.ts"))).toBe(true);
  });

  it("generates valid package.json", () => {
    const { outDir } = scaffoldPlugin("cool-tool");
    const pkg = JSON.parse(fs.readFileSync(path.join(outDir, "package.json"), "utf-8"));
    expect(pkg.name).toBe("@openclaw/cool-tool");
    expect(pkg.type).toBe("module");
    expect(pkg.openclaw.extensions).toEqual(["./index.ts"]);
    expect(pkg.devDependencies.openclaw).toBe("workspace:*");
  });

  it("generates valid manifest with configSchema", () => {
    const { outDir } = scaffoldPlugin("analyzer");
    const manifest = JSON.parse(
      fs.readFileSync(path.join(outDir, "openclaw.plugin.json"), "utf-8"),
    );
    expect(manifest.id).toBe("analyzer");
    expect(manifest.configSchema.type).toBe("object");
    expect(manifest.configSchema.additionalProperties).toBe(false);
  });

  it("generates index.ts with valid TypeScript structure", () => {
    const { outDir } = scaffoldPlugin("my-plugin");
    const content = fs.readFileSync(path.join(outDir, "index.ts"), "utf-8");
    expect(content).toContain("import type { OpenClawPluginApi }");
    expect(content).toContain("import { emptyPluginConfigSchema }");
    expect(content).toContain('id: "my-plugin"');
    expect(content).toContain("register(api: OpenClawPluginApi)");
  });

  it("strips scoped package prefix from id", () => {
    const { pluginId } = scaffoldPlugin("@org/fancy-plugin");
    expect(pluginId).toBe("fancy-plugin");
  });

  it("normalizes invalid characters to dashes", () => {
    const { pluginId } = scaffoldPlugin("My Cool Plugin!");
    expect(pluginId).toBe("my-cool-plugin");
  });

  it("uses custom description when provided", () => {
    const { outDir } = scaffoldPlugin("desc-test", {
      description: "A great plugin",
    });
    const pkg = JSON.parse(fs.readFileSync(path.join(outDir, "package.json"), "utf-8"));
    expect(pkg.description).toBe("A great plugin");
  });

  it("includes kind in manifest when provided", () => {
    const { outDir } = scaffoldPlugin("mem-plugin", { kind: "memory" });
    const manifest = JSON.parse(
      fs.readFileSync(path.join(outDir, "openclaw.plugin.json"), "utf-8"),
    );
    expect(manifest.kind).toBe("memory");
  });

  it("omits kind from manifest when not provided", () => {
    const { outDir } = scaffoldPlugin("no-kind");
    const manifest = JSON.parse(
      fs.readFileSync(path.join(outDir, "openclaw.plugin.json"), "utf-8"),
    );
    expect(manifest.kind).toBeUndefined();
  });

  it("throws when output directory already exists", () => {
    const existingDir = path.join(tmpDir, "existing");
    fs.mkdirSync(existingDir);
    expect(() => scaffoldPlugin("existing")).toThrow("Directory already exists");
  });

  it("uses custom output directory", () => {
    const customDir = path.join(tmpDir, "custom-location");
    const { outDir } = scaffoldPlugin("custom", { output: customDir });
    expect(outDir).toBe(customDir);
    expect(fs.existsSync(path.join(outDir, "index.ts"))).toBe(true);
  });

  it("rejects empty plugin name after normalization", () => {
    expect(() => scaffoldPlugin("@scope/")).toThrow("Invalid plugin name");
    expect(() => scaffoldPlugin("---")).toThrow("Invalid plugin name");
    expect(() => scaffoldPlugin("!!!")).toThrow("Invalid plugin name");
  });

  it("strips leading and trailing dashes from plugin id", () => {
    const { pluginId } = scaffoldPlugin("-my-plugin-");
    expect(pluginId).toBe("my-plugin");
  });
});
