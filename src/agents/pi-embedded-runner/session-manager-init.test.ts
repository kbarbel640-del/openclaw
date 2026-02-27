import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CURRENT_SESSION_VERSION, SessionManager } from "@mariozechner/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { prepareSessionManagerForRun } from "./session-manager-init.js";

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe("prepareSessionManagerForRun", () => {
  it("stamps header.cwd for existing transcript files without assistant messages", async () => {
    const dir = makeTempDir("openclaw-session-init-");
    const sessionFile = path.join(dir, "sess.jsonl");

    fs.writeFileSync(
      sessionFile,
      `${JSON.stringify({
        type: "session",
        version: CURRENT_SESSION_VERSION,
        id: "old-session-id",
        timestamp: new Date().toISOString(),
        cwd: "/",
      })}\n`,
      "utf-8",
    );

    const sm = SessionManager.open(sessionFile) as unknown as { fileEntries: Array<unknown> };
    await prepareSessionManagerForRun({
      sessionManager: sm,
      sessionFile,
      hadSessionFile: true,
      sessionId: "new-session-id",
      cwd: "/tmp/workspace",
    });

    const header = sm.fileEntries.find(
      (entry): entry is { type: "session"; id?: string; cwd?: string } =>
        typeof entry === "object" &&
        entry !== null &&
        (entry as { type?: unknown }).type === "session",
    );
    expect(header?.id).toBe("new-session-id");
    expect(header?.cwd).toBe("/tmp/workspace");
    expect(fs.readFileSync(sessionFile, "utf-8")).toBe("");
  });

  it("stamps header.cwd when the transcript file does not exist yet", async () => {
    const sm = SessionManager.inMemory() as unknown as { fileEntries: Array<unknown> };
    await prepareSessionManagerForRun({
      sessionManager: sm,
      sessionFile: "/dev/null",
      hadSessionFile: false,
      sessionId: "sess-1",
      cwd: "/tmp/workspace",
    });

    const header = sm.fileEntries.find(
      (entry): entry is { type: "session"; id?: string; cwd?: string } =>
        typeof entry === "object" &&
        entry !== null &&
        (entry as { type?: unknown }).type === "session",
    );
    expect(header?.id).toBe("sess-1");
    expect(header?.cwd).toBe("/tmp/workspace");
  });
});
