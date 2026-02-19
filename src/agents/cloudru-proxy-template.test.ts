import { describe, expect, it } from "vitest";
import {
  CLOUDRU_BASE_URL,
  CLOUDRU_FM_PRESETS,
  CLOUDRU_PROXY_IMAGE,
  CLOUDRU_PROXY_PORT_DEFAULT,
} from "../config/cloudru-fm.constants.js";
import { generateProxyDockerCompose } from "./cloudru-proxy-template.js";

/** Minimal YAML key-value parser — good enough for flat Docker Compose validation. */
function yamlLines(yaml: string): string[] {
  return yaml.split("\n").filter((l) => l.trim() !== "");
}

describe("generateProxyDockerCompose", () => {
  const preset = CLOUDRU_FM_PRESETS["cloudru-fm-glm47"];
  const port = CLOUDRU_PROXY_PORT_DEFAULT;

  it("uses the correct image from constants", () => {
    const yaml = generateProxyDockerCompose({ port, preset });
    expect(yaml).toContain(`image: ${CLOUDRU_PROXY_IMAGE}`);
  });

  it("binds port to localhost only", () => {
    const yaml = generateProxyDockerCompose({ port, preset });
    expect(yaml).toContain(`"127.0.0.1:${port}:${port}"`);
  });

  it("sets model environment variables from preset", () => {
    const yaml = generateProxyDockerCompose({ port, preset });
    expect(yaml).toContain(`BIG_MODEL: "${preset.big}"`);
    expect(yaml).toContain(`MIDDLE_MODEL: "${preset.middle}"`);
    expect(yaml).toContain(`SMALL_MODEL: "${preset.small}"`);
  });

  it("includes OPENAI_BASE_URL pointing to Cloud.ru", () => {
    const yaml = generateProxyDockerCompose({ port, preset });
    expect(yaml).toContain(`OPENAI_BASE_URL: "${CLOUDRU_BASE_URL}"`);
  });

  it("uses CLOUDRU_API_KEY env var interpolation for API key", () => {
    const yaml = generateProxyDockerCompose({ port, preset });
    // Docker Compose variable substitution syntax
    expect(yaml).toContain('OPENAI_API_KEY: "${CLOUDRU_API_KEY}"');
  });

  it("includes security hardening: no-new-privileges", () => {
    const yaml = generateProxyDockerCompose({ port, preset });
    expect(yaml).toContain("no-new-privileges:true");
  });

  it("includes security hardening: cap_drop ALL", () => {
    const yaml = generateProxyDockerCompose({ port, preset });
    expect(yaml).toContain("cap_drop:");
    expect(yaml).toContain("- ALL");
  });

  it("includes resource limits", () => {
    const yaml = generateProxyDockerCompose({ port, preset });
    expect(yaml).toContain("memory: 512M");
    expect(yaml).toContain('cpus: "1.0"');
  });

  it("includes healthcheck with correct port", () => {
    const yaml = generateProxyDockerCompose({ port, preset });
    expect(yaml).toContain(`http://localhost:${port}/health`);
    expect(yaml).toContain("interval: 10s");
    expect(yaml).toContain("timeout: 5s");
    expect(yaml).toContain("retries: 3");
  });

  it("uses restart: unless-stopped", () => {
    const yaml = generateProxyDockerCompose({ port, preset });
    expect(yaml).toContain("restart: unless-stopped");
  });

  it("sets container_name to openclaw-cloudru-proxy", () => {
    const yaml = generateProxyDockerCompose({ port, preset });
    expect(yaml).toContain("container_name: openclaw-cloudru-proxy");
  });

  it("works with custom port", () => {
    const customPort = 9999;
    const yaml = generateProxyDockerCompose({ port: customPort, preset });
    expect(yaml).toContain(`"127.0.0.1:${customPort}:${customPort}"`);
    expect(yaml).toContain(`PORT: "${customPort}"`);
    expect(yaml).toContain(`http://localhost:${customPort}/health`);
  });

  it("works with all presets", () => {
    for (const [name, p] of Object.entries(CLOUDRU_FM_PRESETS)) {
      const yaml = generateProxyDockerCompose({ port, preset: p });
      expect(yaml, `preset ${name} should contain BIG_MODEL`).toContain(`BIG_MODEL: "${p.big}"`);
      expect(yaml, `preset ${name} should contain MIDDLE_MODEL`).toContain(
        `MIDDLE_MODEL: "${p.middle}"`,
      );
      expect(yaml, `preset ${name} should contain SMALL_MODEL`).toContain(
        `SMALL_MODEL: "${p.small}"`,
      );
    }
  });

  it("produces valid YAML structure (services at top level)", () => {
    const yaml = generateProxyDockerCompose({ port, preset });
    const lines = yamlLines(yaml);
    expect(lines[0]).toBe("services:");
    expect(lines[1]).toMatch(/^\s+claude-code-proxy:/);
  });

  it("disables thinking by default", () => {
    const yaml = generateProxyDockerCompose({ port, preset });
    expect(yaml).toContain('DISABLE_THINKING: "true"');
  });
});
