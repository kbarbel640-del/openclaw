import { describe, expect, it } from "vitest";
import { runCronDirectCommand } from "./direct-command.js";

describe("runCronDirectCommand", () => {
  it("executes argv commands without shell interpolation", async () => {
    const result = await runCronDirectCommand({
      jobId: "job-1",
      payload: {
        kind: "directCommand",
        command: process.execPath,
        args: ["-e", "process.stdout.write(process.argv[1])", "hello world"],
      },
    });

    expect(result.status).toBe("ok");
    expect(result.summary).toBe("hello world");
  });

  it("returns an error for non-zero exits", async () => {
    const result = await runCronDirectCommand({
      jobId: "job-2",
      payload: {
        kind: "directCommand",
        command: process.execPath,
        args: ["-e", "process.stderr.write('boom'); process.exit(4)"],
      },
    });

    expect(result.status).toBe("error");
    expect(result.error).toContain("code 4");
    expect(result.summary).toContain("boom");
  });
});
