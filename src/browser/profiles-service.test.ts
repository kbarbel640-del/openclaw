import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// The barrel `../config/config.js` re-exports from `../config/io.js`.
// Vitest's vi.mock does not intercept ESM barrel re-exports reliably,
// so we spy on the source module directly.
import * as configIo from "../config/io.js";
import * as chromePaths from "./chrome-paths.js";
import { resolveBrowserConfig } from "./config.js";
import { createBrowserProfilesService } from "./profiles-service.js";
import type { BrowserRouteContext, BrowserServerState } from "./server-context.js";
import * as trashModule from "./trash.js";

function createCtx(resolved: BrowserServerState["resolved"]) {
  const state: BrowserServerState = {
    server: null as unknown as BrowserServerState["server"],
    port: 0,
    resolved,
    profiles: new Map(),
  };

  const ctx = {
    state: () => state,
    listProfiles: vi.fn(async () => []),
    forProfile: vi.fn(() => ({
      stopRunningBrowser: vi.fn(async () => ({ stopped: true })),
    })),
  } as unknown as BrowserRouteContext;

  return { state, ctx };
}

describe("BrowserProfilesService", () => {
  let spyLoadConfig: ReturnType<typeof vi.spyOn>;
  let spyWriteConfigFile: ReturnType<typeof vi.spyOn>;
  let spyResolveUserDataDir: ReturnType<typeof vi.spyOn>;
  let spyMovePathToTrash: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spyLoadConfig = vi.spyOn(configIo, "loadConfig");
    spyWriteConfigFile = vi.spyOn(configIo, "writeConfigFile").mockResolvedValue(undefined);
    spyResolveUserDataDir = vi
      .spyOn(chromePaths, "resolveOpenClawUserDataDir")
      .mockReturnValue("/tmp/openclaw-test/openclaw/user-data");
    spyMovePathToTrash = vi
      .spyOn(trashModule, "movePathToTrash")
      .mockImplementation(async (targetPath: string) => targetPath);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allocates next local port for new profiles", async () => {
    const resolved = resolveBrowserConfig({});
    const { ctx, state } = createCtx(resolved);

    spyLoadConfig.mockReturnValue({ browser: { profiles: {} } });

    const service = createBrowserProfilesService(ctx);
    const result = await service.createProfile({ name: "work" });

    expect(result.cdpPort).toBe(18801);
    expect(result.isRemote).toBe(false);
    expect(state.resolved.profiles.work?.cdpPort).toBe(18801);
    expect(spyWriteConfigFile).toHaveBeenCalled();
  });

  it("accepts per-profile cdpUrl for remote Chrome", async () => {
    const resolved = resolveBrowserConfig({});
    const { ctx } = createCtx(resolved);

    spyLoadConfig.mockReturnValue({ browser: { profiles: {} } });

    const service = createBrowserProfilesService(ctx);
    const result = await service.createProfile({
      name: "remote",
      cdpUrl: "http://10.0.0.42:9222",
    });

    expect(result.cdpUrl).toBe("http://10.0.0.42:9222");
    expect(result.cdpPort).toBe(9222);
    expect(result.isRemote).toBe(true);
    expect(spyWriteConfigFile).toHaveBeenCalledWith(
      expect.objectContaining({
        browser: expect.objectContaining({
          profiles: expect.objectContaining({
            remote: expect.objectContaining({
              cdpUrl: "http://10.0.0.42:9222",
            }),
          }),
        }),
      }),
    );
  });

  it("deletes remote profiles without stopping or removing local data", async () => {
    const resolved = resolveBrowserConfig({
      profiles: {
        remote: { cdpUrl: "http://10.0.0.42:9222", color: "#0066CC" },
      },
    });
    const { ctx } = createCtx(resolved);

    spyLoadConfig.mockReturnValue({
      browser: {
        defaultProfile: "openclaw",
        profiles: {
          openclaw: { cdpPort: 18800, color: "#FF4500" },
          remote: { cdpUrl: "http://10.0.0.42:9222", color: "#0066CC" },
        },
      },
    });

    const service = createBrowserProfilesService(ctx);
    const result = await service.deleteProfile("remote");

    expect(result.deleted).toBe(false);
    expect(ctx.forProfile).not.toHaveBeenCalled();
    expect(spyMovePathToTrash).not.toHaveBeenCalled();
  });

  it("deletes local profiles and moves data to Trash", async () => {
    const resolved = resolveBrowserConfig({
      profiles: {
        work: { cdpPort: 18801, color: "#0066CC" },
      },
    });
    const { ctx } = createCtx(resolved);

    spyLoadConfig.mockReturnValue({
      browser: {
        defaultProfile: "openclaw",
        profiles: {
          openclaw: { cdpPort: 18800, color: "#FF4500" },
          work: { cdpPort: 18801, color: "#0066CC" },
        },
      },
    });

    const tempDir = fs.mkdtempSync(path.join("/tmp", "openclaw-profile-"));
    const userDataDir = path.join(tempDir, "work", "user-data");
    fs.mkdirSync(path.dirname(userDataDir), { recursive: true });
    spyResolveUserDataDir.mockReturnValue(userDataDir);

    const service = createBrowserProfilesService(ctx);
    const result = await service.deleteProfile("work");

    expect(result.deleted).toBe(true);
    expect(spyMovePathToTrash).toHaveBeenCalledWith(path.dirname(userDataDir));
  });
});
