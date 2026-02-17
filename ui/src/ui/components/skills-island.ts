import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { gateway } from "../../services/gateway.ts";
import type { SkillMessageMap } from "../controllers/skills.ts";
import type { SkillStatusReport } from "../types.ts";
import { renderSkills, type SkillsProps } from "../views/skills.ts";

function clearMessageKey(map: SkillMessageMap, key: string): SkillMessageMap {
  const next = { ...map };
  delete next[key];
  return next;
}

@customElement("skills-island")
export class SkillsIsland extends LitElement {
  @state() private loading = false;
  @state() private report: SkillStatusReport | null = null;
  @state() private error: string | null = null;
  @state() private filter = "";
  @state() private edits: Record<string, string> = {};
  @state() private busyKey: string | null = null;
  @state() private messages: SkillMessageMap = {};

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadData();
  }

  private async loadData() {
    this.loading = true;
    this.error = null;
    try {
      const result = await gateway.call<SkillStatusReport>("skills.status");
      this.report = result;
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private handleFilterChange(next: string) {
    this.filter = next;
  }

  private async handleToggle(skillKey: string, enabled: boolean) {
    this.busyKey = skillKey;
    this.messages = clearMessageKey(this.messages, skillKey);
    try {
      await gateway.call("skills.toggle", { skillKey, enabled });
      await this.loadData();
      this.messages = {
        ...this.messages,
        [skillKey]: { kind: "success", message: enabled ? "Enabled" : "Disabled" },
      };
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
      this.messages = {
        ...this.messages,
        [skillKey]: { kind: "error", message: err instanceof Error ? err.message : String(err) },
      };
    } finally {
      this.busyKey = null;
    }
  }

  private handleEdit(skillKey: string, value: string) {
    this.edits = { ...this.edits, [skillKey]: value };
  }

  private async handleSaveKey(skillKey: string) {
    const apiKey = this.edits[skillKey];
    if (!apiKey?.trim()) {
      return;
    }
    this.busyKey = skillKey;
    this.messages = clearMessageKey(this.messages, skillKey);
    try {
      await gateway.call("skills.setApiKey", { skillKey, apiKey });
      this.edits = { ...this.edits, [skillKey]: "" };
      this.messages = {
        ...this.messages,
        [skillKey]: { kind: "success", message: "API key saved" },
      };
    } catch (err) {
      this.messages = {
        ...this.messages,
        [skillKey]: { kind: "error", message: err instanceof Error ? err.message : String(err) },
      };
    } finally {
      this.busyKey = null;
    }
  }

  private async handleInstall(skillKey: string, _name: string, installId: string) {
    this.busyKey = skillKey;
    this.messages = clearMessageKey(this.messages, skillKey);
    try {
      await gateway.call("skills.install", { skillKey, installId });
      await this.loadData();
      this.messages = {
        ...this.messages,
        [skillKey]: { kind: "success", message: "Installed successfully" },
      };
    } catch (err) {
      this.messages = {
        ...this.messages,
        [skillKey]: { kind: "error", message: err instanceof Error ? err.message : String(err) },
      };
    } finally {
      this.busyKey = null;
    }
  }

  render() {
    const props: SkillsProps = {
      loading: this.loading,
      report: this.report,
      error: this.error,
      filter: this.filter,
      edits: this.edits,
      busyKey: this.busyKey,
      messages: this.messages,
      onFilterChange: (next) => this.handleFilterChange(next),
      onRefresh: () => void this.loadData(),
      onToggle: (skillKey, enabled) => void this.handleToggle(skillKey, enabled),
      onEdit: (skillKey, value) => this.handleEdit(skillKey, value),
      onSaveKey: (skillKey) => void this.handleSaveKey(skillKey),
      onInstall: (skillKey, name, installId) => void this.handleInstall(skillKey, name, installId),
    };

    return html`${renderSkills(props)}`;
  }
}
