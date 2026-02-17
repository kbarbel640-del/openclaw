/**
 * Agents Island - Interactive agent management for Astro.
 * Wraps the existing renderAgents view with gateway service calls.
 */

import { StoreController } from "@nanostores/lit";
import { LitElement, html, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { gateway } from "../../services/gateway.ts";
import { $connected } from "../../stores/app.ts";
import type { AgentResourcesResult } from "../controllers/agent-resources.ts";
import type {
  AgentsListResult,
  AgentsFilesListResult,
  AgentIdentityResult,
  AgentHierarchyResult,
  ChannelsStatusSnapshot,
  CronJob,
  CronStatus,
  SkillStatusReport,
} from "../types.ts";
import { renderAgents, type AgentsProps, type AgentsPanel } from "../views/agents.ts";

@customElement("agents-island")
export class AgentsIsland extends LitElement {
  private connectedCtrl = new StoreController(this, $connected);

  @state() private loading = false;
  @state() private error: string | null = null;
  @state() private agentsList: AgentsListResult | null = null;
  @state() private selectedAgentId: string | null = null;
  @state() private activePanel: AgentsPanel = "overview";
  @state() private configForm: Record<string, unknown> | null = null;
  @state() private configLoading = false;
  @state() private configSaving = false;
  @state() private configDirty = false;
  @state() private channelsLoading = false;
  @state() private channelsError: string | null = null;
  @state() private channelsSnapshot: ChannelsStatusSnapshot | null = null;
  @state() private channelsLastSuccess: number | null = null;
  @state() private cronLoading = false;
  @state() private cronStatus: CronStatus | null = null;
  @state() private cronJobs: CronJob[] = [];
  @state() private cronError: string | null = null;
  @state() private agentFilesLoading = false;
  @state() private agentFilesError: string | null = null;
  @state() private agentFilesList: AgentsFilesListResult | null = null;
  @state() private agentFileActive: string | null = null;
  @state() private agentFileContents: Record<string, string> = {};
  @state() private agentFileDrafts: Record<string, string> = {};
  @state() private agentFileSaving = false;
  @state() private agentIdentityLoading = false;
  @state() private agentIdentityError: string | null = null;
  @state() private agentIdentityById: Record<string, AgentIdentityResult> = {};
  @state() private agentSkillsLoading = false;
  @state() private agentSkillsReport: SkillStatusReport | null = null;
  @state() private agentSkillsError: string | null = null;
  @state() private agentSkillsAgentId: string | null = null;
  @state() private agentResourcesData: AgentResourcesResult | null = null;
  @state() private agentResourcesLoading = false;
  @state() private agentHierarchyLoading = false;
  @state() private agentHierarchyError: string | null = null;
  @state() private agentHierarchyData: AgentHierarchyResult | null = null;
  @state() private skillsFilter = "";

  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadAgents();
  }

  private async loadAgents() {
    this.loading = true;
    this.error = null;
    try {
      const res = await gateway.call<AgentsListResult>("agents.list");
      this.agentsList = res;
      const known = res.agents.some((a) => a.id === this.selectedAgentId);
      if (!this.selectedAgentId || !known) {
        this.selectedAgentId = res.defaultId ?? res.agents[0]?.id ?? null;
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private async loadFiles(agentId: string) {
    this.agentFilesLoading = true;
    this.agentFilesError = null;
    try {
      const res = await gateway.call<AgentsFilesListResult>("agents.files.list", { agentId });
      this.agentFilesList = res;
    } catch (err) {
      this.agentFilesError = err instanceof Error ? err.message : String(err);
    } finally {
      this.agentFilesLoading = false;
    }
  }

  private async selectFile(name: string) {
    this.agentFileActive = name;
    if (this.agentFileContents[name] !== undefined) {
      return;
    }
    if (!this.selectedAgentId) {
      return;
    }
    try {
      const res = await gateway.call<{ content: string }>("agents.files.read", {
        agentId: this.selectedAgentId,
        name,
      });
      this.agentFileContents = { ...this.agentFileContents, [name]: res.content };
      this.agentFileDrafts = { ...this.agentFileDrafts, [name]: res.content };
    } catch (err) {
      this.agentFilesError = err instanceof Error ? err.message : String(err);
    }
  }

  private async saveFile(name: string) {
    if (!this.selectedAgentId) {
      return;
    }
    this.agentFileSaving = true;
    try {
      await gateway.call("agents.files.write", {
        agentId: this.selectedAgentId,
        name,
        content: this.agentFileDrafts[name],
      });
      this.agentFileContents = { ...this.agentFileContents, [name]: this.agentFileDrafts[name] };
    } catch (err) {
      this.agentFilesError = err instanceof Error ? err.message : String(err);
    } finally {
      this.agentFileSaving = false;
    }
  }

  private async loadChannels() {
    this.channelsLoading = true;
    this.channelsError = null;
    try {
      const res = await gateway.call<ChannelsStatusSnapshot | null>("channels.status", {
        probe: false,
        timeoutMs: 8000,
      });
      this.channelsSnapshot = res;
      this.channelsLastSuccess = Date.now();
    } catch (err) {
      this.channelsError = err instanceof Error ? err.message : String(err);
    } finally {
      this.channelsLoading = false;
    }
  }

  private async loadCron() {
    this.cronLoading = true;
    this.cronError = null;
    try {
      const [status, jobs] = await Promise.all([
        gateway.call<CronStatus>("cron.status"),
        gateway.call<{ jobs: CronJob[] }>("cron.list"),
      ]);
      this.cronStatus = status;
      this.cronJobs = jobs.jobs;
    } catch (err) {
      this.cronError = err instanceof Error ? err.message : String(err);
    } finally {
      this.cronLoading = false;
    }
  }

  private async loadSkills() {
    if (!this.selectedAgentId) {
      return;
    }
    this.agentSkillsLoading = true;
    this.agentSkillsError = null;
    this.agentSkillsAgentId = this.selectedAgentId;
    try {
      const res = await gateway.call<SkillStatusReport>("skills.status", {
        agentId: this.selectedAgentId,
      });
      this.agentSkillsReport = res;
    } catch (err) {
      this.agentSkillsError = err instanceof Error ? err.message : String(err);
    } finally {
      this.agentSkillsLoading = false;
    }
  }

  private async loadHierarchy() {
    this.agentHierarchyLoading = true;
    this.agentHierarchyError = null;
    try {
      const res = await gateway.call<AgentHierarchyResult>("agents.hierarchy");
      this.agentHierarchyData = res;
    } catch (err) {
      this.agentHierarchyError = err instanceof Error ? err.message : String(err);
    } finally {
      this.agentHierarchyLoading = false;
    }
  }

  private async handleToolsProfileChange(
    agentId: string,
    profile: string | null,
    clearAllow: boolean,
  ) {
    try {
      await gateway.call("agents.tools.setProfile", { agentId, profile, clearAllow });
      await this.loadAgents();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private async handleToolsOverridesChange(agentId: string, alsoAllow: string[], deny: string[]) {
    try {
      await gateway.call("agents.tools.setOverrides", { agentId, alsoAllow, deny });
      await this.loadAgents();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private async handleModelChange(agentId: string, modelId: string | null) {
    try {
      await gateway.call("agents.model.set", { agentId, modelId });
      await this.loadAgents();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private async handleModelFallbacksChange(agentId: string, fallbacks: string[]) {
    try {
      await gateway.call("agents.model.setFallbacks", { agentId, fallbacks });
      await this.loadAgents();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private async handleSkillToggle(agentId: string, skillName: string, enabled: boolean) {
    try {
      await gateway.call("agents.skills.toggle", { agentId, skillName, enabled });
      await this.loadSkills();
    } catch (err) {
      this.agentSkillsError = err instanceof Error ? err.message : String(err);
    }
  }

  private async handleSkillsClear(agentId: string) {
    try {
      await gateway.call("agents.skills.clear", { agentId });
      await this.loadSkills();
    } catch (err) {
      this.agentSkillsError = err instanceof Error ? err.message : String(err);
    }
  }

  private async handleSkillsDisableAll(agentId: string) {
    try {
      await gateway.call("agents.skills.disableAll", { agentId });
      await this.loadSkills();
    } catch (err) {
      this.agentSkillsError = err instanceof Error ? err.message : String(err);
    }
  }

  render(): TemplateResult {
    const props: AgentsProps = {
      loading: this.loading,
      error: this.error,
      agentsList: this.agentsList,
      selectedAgentId: this.selectedAgentId,
      activePanel: this.activePanel,
      configForm: this.configForm,
      configLoading: this.configLoading,
      configSaving: this.configSaving,
      configDirty: this.configDirty,
      channelsLoading: this.channelsLoading,
      channelsError: this.channelsError,
      channelsSnapshot: this.channelsSnapshot,
      channelsLastSuccess: this.channelsLastSuccess,
      cronLoading: this.cronLoading,
      cronStatus: this.cronStatus,
      cronJobs: this.cronJobs,
      cronError: this.cronError,
      agentFilesLoading: this.agentFilesLoading,
      agentFilesError: this.agentFilesError,
      agentFilesList: this.agentFilesList,
      agentFileActive: this.agentFileActive,
      agentFileContents: this.agentFileContents,
      agentFileDrafts: this.agentFileDrafts,
      agentFileSaving: this.agentFileSaving,
      agentIdentityLoading: this.agentIdentityLoading,
      agentIdentityError: this.agentIdentityError,
      agentIdentityById: this.agentIdentityById,
      agentSkillsLoading: this.agentSkillsLoading,
      agentSkillsReport: this.agentSkillsReport,
      agentSkillsError: this.agentSkillsError,
      agentSkillsAgentId: this.agentSkillsAgentId,
      agentResourcesData: this.agentResourcesData,
      agentResourcesLoading: this.agentResourcesLoading,
      agentHierarchyLoading: this.agentHierarchyLoading,
      agentHierarchyError: this.agentHierarchyError,
      agentHierarchyData: this.agentHierarchyData,
      skillsFilter: this.skillsFilter,
      onRefresh: () => void this.loadAgents(),
      onSelectAgent: (agentId: string) => {
        this.selectedAgentId = agentId;
        this.agentFileActive = null;
        this.agentFileContents = {};
        this.agentFileDrafts = {};
        this.agentFilesList = null;
      },
      onSelectPanel: (panel: AgentsPanel) => {
        this.activePanel = panel;
        if (panel === "files" && this.selectedAgentId) {
          void this.loadFiles(this.selectedAgentId);
        } else if (panel === "channels") {
          void this.loadChannels();
        } else if (panel === "cron") {
          void this.loadCron();
        } else if (panel === "skills") {
          void this.loadSkills();
        } else if (panel === "hierarchy") {
          void this.loadHierarchy();
        }
      },
      onLoadFiles: (agentId: string) => void this.loadFiles(agentId),
      onSelectFile: (name: string) => void this.selectFile(name),
      onFileDraftChange: (name: string, content: string) => {
        this.agentFileDrafts = { ...this.agentFileDrafts, [name]: content };
      },
      onFileReset: (name: string) => {
        const original = this.agentFileContents[name];
        if (original !== undefined) {
          this.agentFileDrafts = { ...this.agentFileDrafts, [name]: original };
        }
      },
      onFileSave: (name: string) => void this.saveFile(name),
      onToolsProfileChange: (agentId, profile, clearAllow) =>
        void this.handleToolsProfileChange(agentId, profile, clearAllow),
      onToolsOverridesChange: (agentId, alsoAllow, deny) =>
        void this.handleToolsOverridesChange(agentId, alsoAllow, deny),
      onConfigReload: () => void this.loadAgents(),
      onConfigSave: () => {
        /* handled via agents.config.save */
      },
      onModelChange: (agentId, modelId) => void this.handleModelChange(agentId, modelId),
      onModelFallbacksChange: (agentId, fallbacks) =>
        void this.handleModelFallbacksChange(agentId, fallbacks),
      onChannelsRefresh: () => void this.loadChannels(),
      onCronRefresh: () => void this.loadCron(),
      onSkillsFilterChange: (next: string) => {
        this.skillsFilter = next;
      },
      onSkillsRefresh: () => void this.loadSkills(),
      onAgentSkillToggle: (agentId, skillName, enabled) =>
        void this.handleSkillToggle(agentId, skillName, enabled),
      onAgentSkillsClear: (agentId) => void this.handleSkillsClear(agentId),
      onAgentSkillsDisableAll: (agentId) => void this.handleSkillsDisableAll(agentId),
      onHierarchyRefresh: () => void this.loadHierarchy(),
      onHierarchyNodeClick: (sessionKey: string) => {
        window.location.href = `/sessions?key=${encodeURIComponent(sessionKey)}`;
      },
    };

    return html`${renderAgents(props)}`;
  }
}
