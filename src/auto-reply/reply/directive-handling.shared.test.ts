import { describe, expect, it } from "vitest";
import {
  SYSTEM_MARK,
  formatDirectiveAck,
  formatOptionsLine,
  withOptions,
  formatElevatedRuntimeHint,
  formatElevatedEvent,
  formatReasoningEvent,
} from "./directive-handling.shared.js";

describe("formatDirectiveAck", () => {
  it("returns empty string unchanged", () => {
    expect(formatDirectiveAck("")).toBe("");
  });

  it("prepends system mark", () => {
    expect(formatDirectiveAck("hello")).toBe(`${SYSTEM_MARK} hello`);
  });

  it("does not double-prepend system mark", () => {
    const already = `${SYSTEM_MARK} already marked`;
    expect(formatDirectiveAck(already)).toBe(already);
  });
});

describe("formatOptionsLine", () => {
  it("wraps options text", () => {
    expect(formatOptionsLine("on | off")).toBe("Options: on | off.");
  });
});

describe("withOptions", () => {
  it("appends options on new line", () => {
    expect(withOptions("Set mode.", "a | b")).toBe("Set mode.\nOptions: a | b.");
  });
});

describe("formatElevatedRuntimeHint", () => {
  it("contains system mark", () => {
    expect(formatElevatedRuntimeHint()).toContain(SYSTEM_MARK);
  });
});

describe("formatElevatedEvent", () => {
  it("formats full level", () => {
    expect(formatElevatedEvent("full")).toContain("FULL");
  });

  it("formats ask level", () => {
    expect(formatElevatedEvent("ask")).toContain("ASK");
  });

  it("formats on level as ASK", () => {
    expect(formatElevatedEvent("on")).toContain("ASK");
  });

  it("formats off level", () => {
    expect(formatElevatedEvent("off")).toContain("OFF");
  });
});

describe("formatReasoningEvent", () => {
  it("formats stream level", () => {
    expect(formatReasoningEvent("stream")).toContain("STREAM");
  });

  it("formats on level", () => {
    expect(formatReasoningEvent("on")).toContain("ON");
  });

  it("formats off level", () => {
    expect(formatReasoningEvent("off")).toContain("OFF");
  });
});
