import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import { renderAgents } from "./agents.ts";
import type { AgentsProps } from "./agents.ts";

function baseProps(): AgentsProps {
  return {
    loading: false,
    error: null,
    agentsList: {
      defaultId: "main",
      agents: [
        {
          id: "main",
          name: "Main",
          identity: null,
        },
      ],
    },
    selectedAgentId: "main",
    activePanel: "overview" as const,
    configForm: {
      agents: {
        defaults: {
          model: {
            primary: "openai/gpt-5-nano",
            fallbacks: ["google/gemini-2.0-flash"],
          },
        },
        list: [],
      },
    } as Record<string, unknown>,
    configLoading: false,
    configSaving: false,
    configDirty: false,
    channelsLoading: false,
    channelsError: null,
    channelsSnapshot: null,
    channelsLastSuccess: null,
    cronLoading: false,
    cronStatus: null,
    cronJobs: [],
    cronError: null,
    agentFilesLoading: false,
    agentFilesError: null,
    agentFilesList: null,
    agentFileActive: null,
    agentFileContents: {},
    agentFileDrafts: {},
    agentFileSaving: false,
    agentIdentityLoading: false,
    agentIdentityError: null,
    agentIdentityById: {},
    toolsCatalogLoading: false,
    toolsCatalogError: null,
    toolsCatalogResult: null,
    agentSkillsLoading: false,
    agentSkillsReport: null,
    agentSkillsError: null,
    agentSkillsAgentId: null,
    skillsFilter: "",
    onRefresh: vi.fn(),
    onSelectAgent: vi.fn(),
    onSelectPanel: vi.fn(),
    onLoadFiles: vi.fn(),
    onSelectFile: vi.fn(),
    onFileDraftChange: vi.fn(),
    onFileReset: vi.fn(),
    onFileSave: vi.fn(),
    onToolsProfileChange: vi.fn(),
    onToolsOverridesChange: vi.fn(),
    onConfigReload: vi.fn(),
    onConfigSave: vi.fn(),
    onModelChange: vi.fn(),
    onModelFallbacksChange: vi.fn(),
    onChannelsRefresh: vi.fn(),
    onCronRefresh: vi.fn(),
    onSkillsFilterChange: vi.fn(),
    onSkillsRefresh: vi.fn(),
    onAgentSkillToggle: vi.fn(),
    onAgentSkillsClear: vi.fn(),
    onAgentSkillsDisableAll: vi.fn(),
  };
}

describe("agents overview", () => {
  it("inherits model fallbacks from agents.defaults when no agents.list entry exists", () => {
    const container = document.createElement("div");
    render(renderAgents(baseProps()), container);

    const fallbackInput = container.querySelector(
      'input[placeholder="provider/model, provider/model"]',
    );

    expect(fallbackInput).not.toBeNull();
    expect(fallbackInput?.value).toContain("google/gemini-2.0-flash");
  });

  it("prefers per-agent fallbacks over defaults", () => {
    const props = baseProps();
    props.configForm = {
      agents: {
        defaults: {
          model: {
            primary: "openai/gpt-5-nano",
            fallbacks: ["google/gemini-2.0-flash"],
          },
        },
        list: [
          {
            id: "main",
            model: {
              primary: "openai/gpt-5-nano",
              fallbacks: ["openai/gpt-5-mini"],
            },
          },
        ],
      },
    } as Record<string, unknown>;

    const container = document.createElement("div");
    render(renderAgents(props), container);

    const fallbackInput = container.querySelector(
      'input[placeholder="provider/model, provider/model"]',
    );

    expect(fallbackInput).not.toBeNull();
    expect(fallbackInput?.value).toContain("openai/gpt-5-mini");
    expect(fallbackInput?.value).not.toContain("google/gemini-2.0-flash");
  });
});
