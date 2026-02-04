import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { SimpleStreamOptions } from "@mariozechner/pi-ai";
import { createAssistantMessageEventStream } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { applyExtraParamsToAgent } from "./extra-params.js";

function createCapturingStreamFn(captured: SimpleStreamOptions[]): StreamFn {
  return (_model, _context, options) => {
    captured.push(options ?? {});
    return createAssistantMessageEventStream();
  };
}

describe("applyExtraParamsToAgent", () => {
  describe("GitHub Copilot headers", () => {
    it("adds IDE headers for github-copilot provider", () => {
      const captured: SimpleStreamOptions[] = [];
      const agent = { streamFn: createCapturingStreamFn(captured) };
      applyExtraParamsToAgent(agent, undefined, "github-copilot", "gpt-4o");

      void agent.streamFn?.({} as never, {} as never, {});

      expect(captured.length).toBe(1);
      expect(captured[0].headers).toMatchObject({
        "User-Agent": "GitHubCopilotChat/0.35.0",
        "Editor-Version": "vscode/1.107.0",
        "Editor-Plugin-Version": "copilot-chat/0.35.0",
        "Copilot-Integration-Id": "vscode-chat",
      });
    });

    it("preserves existing headers when adding Copilot headers", () => {
      const captured: SimpleStreamOptions[] = [];
      const agent = { streamFn: createCapturingStreamFn(captured) };
      applyExtraParamsToAgent(agent, undefined, "github-copilot", "gpt-4o");

      void agent.streamFn?.({} as never, {} as never, {
        headers: { "X-Custom": "value" },
      });

      expect(captured[0].headers).toMatchObject({
        "User-Agent": "GitHubCopilotChat/0.35.0",
        "X-Custom": "value",
      });
    });

    it("allows config to override default Copilot headers", () => {
      const captured: SimpleStreamOptions[] = [];
      const cfg: OpenClawConfig = {
        models: {
          providers: {
            "github-copilot": {
              baseUrl: "https://api.github.com",
              headers: {
                "Editor-Version": "vscode/1.120.0",
                "X-Custom-Header": "custom-value",
              },
              models: [],
            },
          },
        },
      };

      const agent = { streamFn: createCapturingStreamFn(captured) };
      applyExtraParamsToAgent(agent, cfg, "github-copilot", "gpt-4o");

      void agent.streamFn?.({} as never, {} as never, {});

      expect(captured[0].headers).toMatchObject({
        "User-Agent": "GitHubCopilotChat/0.35.0",
        "Editor-Version": "vscode/1.120.0",
        "Editor-Plugin-Version": "copilot-chat/0.35.0",
        "Copilot-Integration-Id": "vscode-chat",
        "X-Custom-Header": "custom-value",
      });
    });

    it("does not add Copilot headers for other providers", () => {
      const captured: SimpleStreamOptions[] = [];
      const agent = { streamFn: createCapturingStreamFn(captured) };
      applyExtraParamsToAgent(agent, undefined, "anthropic", "claude-3-opus");

      void agent.streamFn?.({} as never, {} as never, {});

      // No Copilot headers should be present
      expect(captured[0].headers?.["Copilot-Integration-Id"]).toBeUndefined();
      expect(captured[0].headers?.["Editor-Version"]).toBeUndefined();
    });
  });

  describe("OpenRouter headers", () => {
    it("adds app attribution headers for openrouter provider", () => {
      const captured: SimpleStreamOptions[] = [];
      const agent = { streamFn: createCapturingStreamFn(captured) };
      applyExtraParamsToAgent(agent, undefined, "openrouter", "anthropic/claude-3-opus");

      void agent.streamFn?.({} as never, {} as never, {});

      expect(captured[0].headers).toMatchObject({
        "HTTP-Referer": "https://openclaw.ai",
        "X-Title": "OpenClaw",
      });
    });
  });

  describe("extraParamsOverride null filtering", () => {
    it("filters out null and undefined values from extraParamsOverride", () => {
      const captured: SimpleStreamOptions[] = [];
      const baseStreamFn: StreamFn = (_model, _context, options) => {
        captured.push(options ?? {});
        return createAssistantMessageEventStream();
      };

      const cfg: OpenClawConfig = {
        agents: {
          defaults: {
            models: {
              "openrouter/anthropic/claude-3-opus": {
                params: { temperature: 0.7, maxTokens: 1000 },
              },
            },
          },
        },
      };

      const agent = { streamFn: baseStreamFn };
      applyExtraParamsToAgent(agent, cfg, "openrouter", "anthropic/claude-3-opus", {
        temperature: null,
        maxTokens: undefined,
      });

      void agent.streamFn?.({} as never, {} as never, {});

      expect(captured[0].temperature).toBe(0.7);
      expect(captured[0].maxTokens).toBe(1000);
    });
  });
});
