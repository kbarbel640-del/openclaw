import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import { renderAgents } from "./agents.ts";

function createProps(
  overrides: Partial<Parameters<typeof renderAgents>[0]> = {},
): Parameters<typeof renderAgents>[0] {
  return {
    loading: false,
    error: null,
    agentsList: {
      defaultId: "main",
      mainKey: "main",
      scope: "per-sender",
      agents: [{ id: "main", name: "Main" }],
    },
    selectedAgentId: "main",
    activePanel: "overview",
    configForm: {
      agents: {
        defaults: {
          workspace: "/tmp/workspace",
          model: { primary: "google/gemini-3-pro-preview", fallbacks: [] },
        },
      },
    },
    configLoading: false,
    configSaving: false,
    configApplying: false,
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
    agentSkillsLoading: false,
    agentSkillsReport: null,
    agentSkillsError: null,
    agentSkillsAgentId: null,
    toolsCatalogLoading: false,
    toolsCatalogError: null,
    toolsCatalogResult: null,
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
    onConfigDiscard: () => undefined,
    onConfigSave: () => undefined,
    onConfigApply: () => undefined,
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

describe("agents overview (browser)", () => {
  it("shows dirty-draft warning and allows discarding/applying", async () => {
    const container = document.createElement("div");
    const onConfigDiscard = vi.fn();
    const onConfigApply = vi.fn();

    render(
      renderAgents(
        createProps({
          configDirty: true,
          onConfigDiscard,
          onConfigApply,
        }),
      ),
      container,
    );
    await Promise.resolve();

    expect(container.textContent ?? "").toContain("Unsaved config draft is active");
    expect(container.textContent ?? "").toContain(
      "Save updates the config file. Apply updates the running gateway.",
    );

    const discardButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "Discard Draft",
    );
    expect(discardButton).toBeTruthy();
    expect(discardButton?.disabled).toBe(false);

    const applyButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "Apply",
    );
    expect(applyButton).toBeTruthy();
    expect(applyButton?.disabled).toBe(false);

    discardButton?.click();
    applyButton?.click();
    expect(onConfigDiscard).toHaveBeenCalledTimes(1);
    expect(onConfigApply).toHaveBeenCalledTimes(1);
  });

  it("allows discard button when form is clean", async () => {
    const container = document.createElement("div");
    const onConfigDiscard = vi.fn();

    render(
      renderAgents(
        createProps({
          configDirty: false,
          onConfigDiscard,
        }),
      ),
      container,
    );
    await Promise.resolve();

    const discardButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "Discard Draft",
    );
    expect(discardButton).toBeTruthy();
    expect(discardButton?.disabled).toBe(false);

    discardButton?.click();
    expect(onConfigDiscard).toHaveBeenCalledTimes(1);
  });
});
