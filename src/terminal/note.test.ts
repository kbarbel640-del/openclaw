import { afterEach, describe, expect, it, vi } from "vitest";

const clackNoteMock = vi.hoisted(() => vi.fn());

vi.mock("@clack/prompts", () => ({
  note: clackNoteMock,
}));

describe("note", () => {
  let originalArgv: string[];

  afterEach(() => {
    if (originalArgv) {
      process.argv = originalArgv;
    }
    vi.clearAllMocks();
  });

  async function loadNote() {
    const mod = await import("./note.js");
    return mod.note;
  }

  it("writes to stdout by default (no --json flag)", async () => {
    originalArgv = process.argv;
    process.argv = ["node", "openclaw", "nodes", "status"];
    const note = await loadNote();

    note("test message", "Title");

    expect(clackNoteMock).toHaveBeenCalledTimes(1);
    // No options object (third arg) when --json is absent
    expect(clackNoteMock).toHaveBeenCalledWith(expect.any(String), expect.any(String), undefined);
  });

  it("redirects to stderr when --json flag is present", async () => {
    originalArgv = process.argv;
    process.argv = ["node", "openclaw", "nodes", "status", "--json"];
    const note = await loadNote();

    note("test message", "Title");

    expect(clackNoteMock).toHaveBeenCalledTimes(1);
    expect(clackNoteMock).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
      output: process.stderr,
    });
  });

  it("redirects to stderr when --json= variant is present", async () => {
    originalArgv = process.argv;
    process.argv = ["node", "openclaw", "nodes", "status", "--json=true"];
    const note = await loadNote();

    note("test message", "Title");

    expect(clackNoteMock).toHaveBeenCalledTimes(1);
    expect(clackNoteMock).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
      output: process.stderr,
    });
  });
});
