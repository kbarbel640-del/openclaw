import { render } from "lit";
import { describe, expect, it } from "vitest";
import type { AgentsProps } from "./agents.ts";
import { renderAgents } from "./agents.ts";

function createProps(overrides: Partial<AgentsProps> = {}): AgentsProps {
  return {
    loading: false,
    error: null,
    agentsList: {
      defaultId: "main",
      mainKey: "main",
      scope: "per-sender",
      agents: [{ id: "main", name: "Hop", identity: { name: "Hop", emoji: "🗝️" } }],
    },
    selectedAgentId: "main",
    activePanel: "overview",
    configForm: null,
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
    agentFilesList: { agentId: "main", workspace: "/tmp/workspace", files: [] },
    agentFileActive: null,
    agentFileContents: {},
    agentFileDrafts: {},
    agentFileSaving: false,
    agentIdentityLoading: false,
    agentIdentityError: null,
    agentIdentityById: {},
    agentSkillsLoading: false,
    agentSkillsReport: null,
    agentSkillsError: null,
    agentSkillsAgentId: null,
    skillsFilter: "",
    onRefresh: () => undefined,
    onSelectAgent: () => undefined,
    onSelectPanel: () => undefined,
    onLoadFiles: () => undefined,
    onSelectFile: () => undefined,
    onFileDraftChange: () => undefined,
    onFileReset: () => undefined,
    onFileSave: () => undefined,
    onToolsProfileChange: () => undefined,
    onToolsOverridesChange: () => undefined,
    onConfigReload: () => undefined,
    onConfigSave: () => undefined,
    onModelChange: () => undefined,
    onModelFallbacksChange: () => undefined,
    onChannelsRefresh: () => undefined,
    onCronRefresh: () => undefined,
    onSkillsFilterChange: () => undefined,
    onSkillsRefresh: () => undefined,
    onAgentSkillToggle: () => undefined,
    onAgentSkillsClear: () => undefined,
    onAgentSkillsDisableAll: () => undefined,
    ...overrides,
  };
}

function queryPrimaryModelSelect(container: HTMLElement): HTMLSelectElement {
  const select = container.querySelector(".agent-model-select select");
  expect(select).not.toBeNull();
  return select as HTMLSelectElement;
}

describe("agents view", () => {
  it("keeps model selection aligned with overview primary model", () => {
    const container = document.createElement("div");
    const config = {
      agents: {
        defaults: {
          model: {
            primary: "openai-codex/gpt-5.3-codex",
            fallbacks: ["openai-codex/gpt-5.2"],
          },
          models: {
            "openai-codex/gpt-5.2": {},
            "openai-codex/gpt-5.3": {},
            "openai-codex/gpt-5.3-codex": {},
            "openai-codex/gpt-5.3-codex-spark": {},
          },
        },
        list: [
          {
            id: "main",
            model: {
              primary: "openai-codex/gpt-5.3-codex-spark",
              fallbacks: ["openai-codex/gpt-5.2"],
            },
          },
        ],
      },
    } as Record<string, unknown>;
    render(renderAgents(createProps({ configForm: config })), container);

    expect(container.textContent).toContain("openai-codex/gpt-5.3-codex-spark (+1 fallback)");
    const select = queryPrimaryModelSelect(container);
    expect(select.value).toBe("openai-codex/gpt-5.3-codex-spark");
  });

  it("keeps an unlisted current model selected using a Current option", () => {
    const container = document.createElement("div");
    const config = {
      agents: {
        defaults: {
          model: {
            primary: "openai-codex/gpt-5.2",
          },
          models: {
            "openai-codex/gpt-5.2": {},
          },
        },
        list: [
          {
            id: "main",
            model: {
              primary: "openai-codex/gpt-5.3-codex-spark",
              fallbacks: ["openai-codex/gpt-5.2"],
            },
          },
        ],
      },
    } as Record<string, unknown>;
    render(renderAgents(createProps({ configForm: config })), container);

    const select = queryPrimaryModelSelect(container);
    expect(select.value).toBe("openai-codex/gpt-5.3-codex-spark");
    expect(select.selectedOptions[0]?.textContent).toContain(
      "Current (openai-codex/gpt-5.3-codex-spark)",
    );
  });
});
