import { describe, expect, it, beforeEach } from "vitest";
import type { SandboxWorkspaceInfo } from "../../agents/sandbox/types.js";
import {
  resolveSandboxFilePath,
  resolveFilePathsInParams,
  clearSandboxContextCache,
} from "./sandbox-path-resolver.js";

describe("resolveSandboxFilePath", () => {
  const mockSandboxWorkspace: SandboxWorkspaceInfo = {
    workspaceDir: "/opt/openclaw/sandboxes/agent-test-123",
    containerWorkdir: "/workspace",
    workspaceAccess: "rw",
  };

  it("should resolve container path to host path", () => {
    const result = resolveSandboxFilePath("/workspace/file.txt", mockSandboxWorkspace);
    expect(result).toBe("/opt/openclaw/sandboxes/agent-test-123/file.txt");
  });

  it("should handle nested container paths", () => {
    const result = resolveSandboxFilePath("/workspace/subdir/file.pdf", mockSandboxWorkspace);
    expect(result).toBe("/opt/openclaw/sandboxes/agent-test-123/subdir/file.pdf");
  });

  it("should return original path for non-sandbox environment", () => {
    const result = resolveSandboxFilePath("/home/user/file.txt", null);
    expect(result).toBe("/home/user/file.txt");
  });

  it("should return original path if not in container workdir", () => {
    const result = resolveSandboxFilePath("/opt/openclaw/file.txt", mockSandboxWorkspace);
    expect(result).toBe("/opt/openclaw/file.txt");
  });

  it("should handle paths with special characters", () => {
    const result = resolveSandboxFilePath("/workspace/my file (1).txt", mockSandboxWorkspace);
    expect(result).toBe("/opt/openclaw/sandboxes/agent-test-123/my file (1).txt");
  });

  it("should handle root workspace path", () => {
    const result = resolveSandboxFilePath("/workspace", mockSandboxWorkspace);
    expect(result).toBe("/opt/openclaw/sandboxes/agent-test-123");
  });

  it("should handle workspace path with trailing slash", () => {
    const result = resolveSandboxFilePath("/workspace/", mockSandboxWorkspace);
    expect(result).toBe("/opt/openclaw/sandboxes/agent-test-123/");
  });
});

describe("resolveFilePathsInParams", () => {
  const mockSandboxWorkspace: SandboxWorkspaceInfo = {
    workspaceDir: "/opt/openclaw/sandboxes/agent-test-123",
    containerWorkdir: "/workspace",
    workspaceAccess: "rw",
  };

  beforeEach(() => {
    clearSandboxContextCache();
  });

  it("should resolve filePath parameter", () => {
    const params = {
      filePath: "/workspace/file.txt",
      message: "Hello",
    };

    const result = resolveFilePathsInParams(params, mockSandboxWorkspace);

    expect(result.filePath).toBe("/opt/openclaw/sandboxes/agent-test-123/file.txt");
    expect(result.message).toBe("Hello");
  });

  it("should resolve multiple file path parameters", () => {
    const params = {
      filePath: "/workspace/file1.txt",
      path: "/workspace/file2.pdf",
      media: "/workspace/image.png",
    };

    const result = resolveFilePathsInParams(params, mockSandboxWorkspace);

    expect(result.filePath).toBe("/opt/openclaw/sandboxes/agent-test-123/file1.txt");
    expect(result.path).toBe("/opt/openclaw/sandboxes/agent-test-123/file2.pdf");
    expect(result.media).toBe("/opt/openclaw/sandboxes/agent-test-123/image.png");
  });

  it("should not modify non-path parameters", () => {
    const params = {
      filePath: "/workspace/file.txt",
      count: 42,
      flag: true,
      url: "http://example.com/file.txt",
    };

    const result = resolveFilePathsInParams(params, mockSandboxWorkspace);

    expect(result.count).toBe(42);
    expect(result.flag).toBe(true);
    expect(result.url).toBe("http://example.com/file.txt");
  });

  it("should not modify relative paths", () => {
    const params = {
      filePath: "./relative/file.txt",
      path: "relative/file2.txt",
    };

    const result = resolveFilePathsInParams(params, mockSandboxWorkspace);

    expect(result.filePath).toBe("./relative/file.txt");
    expect(result.path).toBe("relative/file2.txt");
  });

  it("should handle non-sandbox environment", () => {
    const params = {
      filePath: "/workspace/file.txt",
      message: "Hello",
    };

    const result = resolveFilePathsInParams(params, null);

    expect(result.filePath).toBe("/workspace/file.txt");
    expect(result.message).toBe("Hello");
  });

  it("should support custom file keys", () => {
    const params = {
      customPath: "/workspace/file.txt",
      anotherPath: "/workspace/file2.txt",
      message: "Hello",
    };

    const result = resolveFilePathsInParams(params, mockSandboxWorkspace, [
      "customPath",
      "anotherPath",
    ]);

    expect(result.customPath).toBe("/opt/openclaw/sandboxes/agent-test-123/file.txt");
    expect(result.anotherPath).toBe("/opt/openclaw/sandboxes/agent-test-123/file2.txt");
    expect(result.message).toBe("Hello");
  });

  it("should not mutate original params object", () => {
    const params = {
      filePath: "/workspace/file.txt",
      message: "Hello",
    };

    const result = resolveFilePathsInParams(params, mockSandboxWorkspace);

    expect(params.filePath).toBe("/workspace/file.txt");
    expect(result).not.toBe(params);
  });
});

describe("getSandboxContextForSession", () => {
  beforeEach(() => {
    clearSandboxContextCache();
  });

  it("should return null for missing sessionKey", async () => {
    const result = await import("./sandbox-path-resolver.js").then((m) =>
      m.getSandboxContextForSession({
        cfg: {} as unknown as import("../../config/config.js").OpenClawConfig,
        sessionKey: undefined,
      }),
    );
    expect(result).toBeNull();
  });

  it("should return null for empty sessionKey", async () => {
    const result = await import("./sandbox-path-resolver.js").then((m) =>
      m.getSandboxContextForSession({
        cfg: {} as unknown as import("../../config/config.js").OpenClawConfig,
        sessionKey: "",
      }),
    );
    expect(result).toBeNull();
  });
});
