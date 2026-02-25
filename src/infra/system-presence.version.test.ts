import { describe, expect, it } from "vitest";
import { VERSION } from "../version.js";
import { listSystemPresence } from "./system-presence.js";

describe("system-presence version (fixes #26763)", () => {
  it("self presence uses running package VERSION so Dashboard shows correct version after update + restart", () => {
    const selfEntry = listSystemPresence().find((entry) => entry.reason === "self");
    expect(selfEntry?.version).toBe(VERSION);
  });
});
