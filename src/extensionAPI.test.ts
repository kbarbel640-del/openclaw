import { describe, expect, it } from "vitest";
import * as extensionApi from "./extensionAPI.js";

describe("extensionAPI exports", () => {
  it("exports createMessageTool", () => {
    expect(typeof extensionApi.createMessageTool).toBe("function");
  });
});
