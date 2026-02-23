import { describe, expect, it } from "vitest";
import { isRunnerAbortError } from "./abort.js";

describe("isRunnerAbortError", () => {
  it("accepts canonical abort errors", () => {
    const err = new Error("anything");
    err.name = "AbortError";
    expect(isRunnerAbortError(err)).toBe(true);
  });

  it("accepts canonical abort code", () => {
    expect(
      isRunnerAbortError({
        name: "Error",
        code: "ABORT_ERR",
        message: "something else",
      }),
    ).toBe(true);
  });

  it("accepts common abort messages", () => {
    expect(isRunnerAbortError(new Error("aborted"))).toBe(true);
    expect(isRunnerAbortError(new Error("The operation was aborted"))).toBe(true);
    expect(isRunnerAbortError(new Error("This operation was aborted."))).toBe(true);
  });

  it("rejects non-abort failures that only mention aborted", () => {
    expect(isRunnerAbortError(new Error("job aborted while parsing output"))).toBe(false);
    expect(isRunnerAbortError(new Error("not aborted yet"))).toBe(false);
  });

  it("rejects non-error values", () => {
    expect(isRunnerAbortError(null)).toBe(false);
    expect(isRunnerAbortError("aborted")).toBe(false);
  });
});
