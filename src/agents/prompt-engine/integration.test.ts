import { describe, expect, it } from "vitest";
import { buildAgentSystemPrompt } from "../system-prompt.js";

describe("ClawdMatrix Engine Integration", () => {
  it("should detect Finance domain and inject Financial skills", async () => {
    const userBuffer = "Analyze the PE ratio of Apple stock.";
    const prompt = await buildAgentSystemPrompt({
      workspaceDir: "/tmp/openclaw",
      userPrompt: userBuffer,
    });

    expect(prompt).toContain("**Role**: Acting as a specialist in Finance");
    expect(prompt).toContain("Active Skills Library");
    expect(prompt).toContain("DTI > 40%");
  });

  it("should detect Coding domain from keywords", async () => {
    const userBuffer = "Write a typescript function to parse JSON.";
    const prompt = await buildAgentSystemPrompt({
      workspaceDir: "/tmp/openclaw",
      userPrompt: userBuffer,
    });

    expect(prompt).toContain("**Role**: Acting as a specialist in Coding");
  });

  it("should build prompt with default context when userPrompt is omitted", async () => {
    const prompt = await buildAgentSystemPrompt({
      workspaceDir: "/tmp/openclaw",
    });

    expect(prompt).toContain("System Prompt:");
    expect(prompt).toContain("Active Skills Library");
  });
});
