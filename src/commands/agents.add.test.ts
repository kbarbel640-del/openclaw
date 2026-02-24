import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { baseConfigSnapshot, createTestRuntime } from "./test-runtime-config-helpers.js";

const readConfigFileSnapshotMock = vi.hoisted(() => vi.fn());
const writeConfigFileMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

const wizardMocks = vi.hoisted(() => ({
  createClackPrompter: vi.fn(),
}));
const onboardingHelpersMocks = vi.hoisted(() => ({
  ensureWorkspaceAndSessions: vi.fn().mockResolvedValue(undefined),
}));
const onboardingChannelMocks = vi.hoisted(() => ({
  setupChannels: vi.fn(async (config: unknown) => config),
}));
const modelCatalogMocks = vi.hoisted(() => ({
  loadModelCatalog: vi.fn().mockResolvedValue([]),
}));

vi.mock("../config/config.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../config/config.js")>()),
  readConfigFileSnapshot: readConfigFileSnapshotMock,
  writeConfigFile: writeConfigFileMock,
}));

vi.mock("../wizard/clack-prompter.js", () => ({
  createClackPrompter: wizardMocks.createClackPrompter,
}));
vi.mock("./onboard-helpers.js", () => ({
  ensureWorkspaceAndSessions: onboardingHelpersMocks.ensureWorkspaceAndSessions,
}));
vi.mock("./onboard-channels.js", () => ({
  setupChannels: onboardingChannelMocks.setupChannels,
}));
vi.mock("../agents/model-catalog.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../agents/model-catalog.js")>()),
  loadModelCatalog: modelCatalogMocks.loadModelCatalog,
}));

import { WizardCancelledError } from "../wizard/prompts.js";
import { agentsAddCommand } from "./agents.js";

const runtime = createTestRuntime();

describe("agents add command", () => {
  beforeEach(() => {
    readConfigFileSnapshotMock.mockClear();
    writeConfigFileMock.mockClear();
    wizardMocks.createClackPrompter.mockClear();
    onboardingHelpersMocks.ensureWorkspaceAndSessions.mockClear();
    onboardingChannelMocks.setupChannels.mockClear();
    modelCatalogMocks.loadModelCatalog.mockClear();
    runtime.log.mockClear();
    runtime.error.mockClear();
    runtime.exit.mockClear();
  });

  it("requires --workspace when flags are present", async () => {
    readConfigFileSnapshotMock.mockResolvedValue({ ...baseConfigSnapshot });

    await agentsAddCommand({ name: "Work" }, runtime, { hasFlags: true });

    expect(runtime.error).toHaveBeenCalledWith(expect.stringContaining("--workspace"));
    expect(runtime.exit).toHaveBeenCalledWith(1);
    expect(writeConfigFileMock).not.toHaveBeenCalled();
  });

  it("requires --workspace in non-interactive mode", async () => {
    readConfigFileSnapshotMock.mockResolvedValue({ ...baseConfigSnapshot });

    await agentsAddCommand({ name: "Work", nonInteractive: true }, runtime, {
      hasFlags: false,
    });

    expect(runtime.error).toHaveBeenCalledWith(expect.stringContaining("--workspace"));
    expect(runtime.exit).toHaveBeenCalledWith(1);
    expect(writeConfigFileMock).not.toHaveBeenCalled();
  });

  it("exits with code 1 when the interactive wizard is cancelled", async () => {
    readConfigFileSnapshotMock.mockResolvedValue({ ...baseConfigSnapshot });
    wizardMocks.createClackPrompter.mockReturnValue({
      intro: vi.fn().mockRejectedValue(new WizardCancelledError()),
      text: vi.fn(),
      confirm: vi.fn(),
      note: vi.fn(),
      outro: vi.fn(),
    });

    await agentsAddCommand({}, runtime);

    expect(runtime.exit).toHaveBeenCalledWith(1);
    expect(writeConfigFileMock).not.toHaveBeenCalled();
  });

  it("does not inherit auth profiles when copy/auth prompts are both declined", async () => {
    const previousStateDir = process.env.OPENCLAW_STATE_DIR;
    const previousAgentDir = process.env.OPENCLAW_AGENT_DIR;
    const previousPiAgentDir = process.env.PI_CODING_AGENT_DIR;
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-agents-add-"));
    try {
      process.env.OPENCLAW_STATE_DIR = tempDir;
      delete process.env.OPENCLAW_AGENT_DIR;
      delete process.env.PI_CODING_AGENT_DIR;

      const mainAgentDir = path.join(tempDir, "agents", "main", "agent");
      const workAgentDir = path.join(tempDir, "agents", "work", "agent");
      await fs.mkdir(mainAgentDir, { recursive: true });
      await fs.writeFile(
        path.join(mainAgentDir, "auth-profiles.json"),
        JSON.stringify(
          {
            version: 1,
            profiles: {
              "openai:default": {
                type: "api_key",
                provider: "openai",
                key: "main-key",
              },
            },
          },
          null,
          2,
        ),
      );

      readConfigFileSnapshotMock.mockResolvedValue({
        ...baseConfigSnapshot,
        config: {},
      });

      const prompter = {
        intro: vi.fn().mockResolvedValue(undefined),
        text: vi
          .fn()
          .mockResolvedValueOnce("work")
          .mockResolvedValueOnce(path.join(tempDir, "workspace-work")),
        confirm: vi
          .fn()
          .mockResolvedValueOnce(false) // Copy auth profiles from "main"?
          .mockResolvedValueOnce(false), // Configure model/auth for this agent now?
        note: vi.fn().mockResolvedValue(undefined),
        outro: vi.fn().mockResolvedValue(undefined),
      };
      wizardMocks.createClackPrompter.mockReturnValue(prompter);

      await agentsAddCommand({}, runtime);

      await expect(fs.stat(path.join(workAgentDir, "auth-profiles.json"))).rejects.toMatchObject({
        code: "ENOENT",
      });
      expect(prompter.confirm).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          message: 'Copy auth profiles from "main"?',
        }),
      );
      expect(prompter.confirm).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          message: "Configure model/auth for this agent now?",
        }),
      );
      expect(prompter.note).toHaveBeenCalledWith(
        expect.stringContaining('Skipped auth setup for "work".'),
        "Auth profiles",
      );
    } finally {
      if (previousStateDir === undefined) {
        delete process.env.OPENCLAW_STATE_DIR;
      } else {
        process.env.OPENCLAW_STATE_DIR = previousStateDir;
      }
      if (previousAgentDir === undefined) {
        delete process.env.OPENCLAW_AGENT_DIR;
      } else {
        process.env.OPENCLAW_AGENT_DIR = previousAgentDir;
      }
      if (previousPiAgentDir === undefined) {
        delete process.env.PI_CODING_AGENT_DIR;
      } else {
        process.env.PI_CODING_AGENT_DIR = previousPiAgentDir;
      }
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
