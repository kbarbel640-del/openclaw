import { describe, it, expect, vi, beforeEach } from "vitest";
import * as storage from "../../sessions/files/storage.js";
import { createSessionFilesListTool, createSessionFilesGetTool } from "./session-files-tool.js";

vi.mock("../../sessions/files/storage.js");

describe("session_files_list tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists files in session", async () => {
    const mockFiles = [
      {
        id: "file-1",
        filename: "test.csv",
        type: "csv" as const,
        uploadedAt: Date.now(),
        size: 100,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        csvSchema: { columns: ["a", "b"], rowCount: 2 },
      },
    ];
    vi.spyOn(storage, "listFiles").mockResolvedValue(mockFiles);

    const tool = createSessionFilesListTool({
      config: {},
      agentSessionKey: "agent:main:main",
    });
    expect(tool).toBeTruthy();

    const result = await tool!.execute("call-1", {
      sessionId: "test-session",
    });
    const content = result.content[0];
    expect(content.type).toBe("text");
    const json = JSON.parse(content.text);
    expect(json.files).toHaveLength(1);
    expect(json.files[0].filename).toBe("test.csv");
  });
});

describe("session_files_get tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets file content", async () => {
    const mockFile = {
      buffer: Buffer.from("test content"),
      metadata: {
        id: "file-1",
        filename: "test.txt",
        type: "text" as const,
        uploadedAt: Date.now(),
        size: 12,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      },
    };
    vi.spyOn(storage, "getFile").mockResolvedValue(mockFile);

    const tool = createSessionFilesGetTool({
      config: {},
      agentSessionKey: "agent:main:main",
    });
    expect(tool).toBeTruthy();

    const result = await tool!.execute("call-1", {
      sessionId: "test-session",
      fileId: "file-1",
    });
    const content = result.content[0];
    expect(content.type).toBe("text");
    const json = JSON.parse(content.text);
    expect(json.content).toBe("test content");
    expect(json.metadata.filename).toBe("test.txt");
  });
});
