import { describe, expect, it } from "vitest";
import config from "./tsdown.config.js";

describe("tsdown config", () => {
  it("disables clean to preserve control-ui assets", () => {
    const configs = Array.isArray(config) ? config : [config];
    for (const entry of configs) {
      expect(
        entry.clean,
        `entry "${entry.entry}" must set clean: false to preserve dist/control-ui/`,
      ).toBe(false);
    }
  });
});
