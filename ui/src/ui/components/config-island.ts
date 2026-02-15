/**
 * Config Island - Interactive configuration editor for Astro.
 * Wraps the existing renderConfig view with gateway service calls.
 */

import { StoreController } from "@nanostores/lit";
import { LitElement, html, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { gateway } from "../../services/gateway.ts";
import { $connected } from "../../stores/app.ts";
import { renderConfig, type ConfigProps } from "../views/config.ts";

@customElement("config-island")
export class ConfigIsland extends LitElement {
  private connectedCtrl = new StoreController(this, $connected);

  @state() private raw = "{}";
  @state() private originalRaw = "{}";
  @state() private valid: boolean | null = null;
  @state() private issues: unknown[] = [];
  @state() private loading = true;
  @state() private saving = false;
  @state() private applying = false;
  @state() private updating = false;
  @state() private schema: unknown = null;
  @state() private schemaLoading = false;
  @state() private uiHints = {};
  @state() private formMode: "form" | "raw" = "form";
  @state() private formValue: Record<string, unknown> | null = null;
  @state() private originalValue: Record<string, unknown> | null = null;
  @state() private searchQuery = "";
  @state() private activeSection: string | null = null;
  @state() private activeSubsection: string | null = null;

  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadConfig();
    void this.loadSchema();
  }

  render(): TemplateResult {
    const props: ConfigProps = {
      raw: this.raw,
      originalRaw: this.originalRaw,
      valid: this.valid,
      issues: this.issues,
      loading: this.loading,
      saving: this.saving,
      applying: this.applying,
      updating: this.updating,
      connected: this.connectedCtrl.value,
      schema: this.schema,
      schemaLoading: this.schemaLoading,
      uiHints: this.uiHints,
      formMode: this.formMode,
      formValue: this.formValue,
      originalValue: this.originalValue,
      searchQuery: this.searchQuery,
      activeSection: this.activeSection,
      activeSubsection: this.activeSubsection,
      onRawChange: (next: string) => {
        this.raw = next;
        this.validateConfig(next);
      },
      onFormModeChange: (mode: "form" | "raw") => {
        this.formMode = mode;
        if (mode === "form" && this.formValue === null && this.raw) {
          try {
            this.formValue = JSON.parse(this.raw) as Record<string, unknown>;
          } catch {
            // Keep null if parse fails
          }
        }
      },
      onFormPatch: (path: Array<string | number>, value: unknown) => {
        if (!this.formValue) {
          return;
        }
        const updated = structuredClone(this.formValue);
        let current: Record<string, unknown> = updated;
        for (let i = 0; i < path.length - 1; i++) {
          const key = String(path[i]);
          if (!(key in current) || typeof current[key] !== "object") {
            current[key] = {};
          }
          current = current[key] as Record<string, unknown>;
        }
        const lastKey = path[path.length - 1];
        if (lastKey !== undefined) {
          current[String(lastKey)] = value;
        }
        this.formValue = updated;
        this.raw = JSON.stringify(updated, null, 2);
      },
      onSearchChange: (query: string) => {
        this.searchQuery = query;
      },
      onSectionChange: (section: string | null) => {
        this.activeSection = section;
        this.activeSubsection = null;
      },
      onSubsectionChange: (subsection: string | null) => {
        this.activeSubsection = subsection;
      },
      onReload: () => void this.loadConfig(),
      onSave: () => void this.saveConfig(),
      onApply: () => void this.applyConfig(),
      onUpdate: () => void this.runUpdate(),
    };

    return html`${renderConfig(props)}`;
  }

  private async loadConfig() {
    this.loading = true;
    try {
      const result = await gateway.call<{
        config?: Record<string, unknown>;
        raw?: string;
        uiHints?: Record<string, unknown>;
      }>("config.get");
      const config = result.config ?? {};
      this.raw = result.raw ?? JSON.stringify(config, null, 2);
      this.originalRaw = this.raw;
      this.formValue = config;
      this.originalValue = structuredClone(config);
      this.uiHints = result.uiHints ?? {};
      this.valid = true;
      this.issues = [];
    } catch (err) {
      this.issues = [{ message: err instanceof Error ? err.message : String(err) }];
    } finally {
      this.loading = false;
    }
  }

  private async loadSchema() {
    this.schemaLoading = true;
    try {
      const result = await gateway.call<{ schema?: unknown }>("config.schema");
      this.schema = result.schema ?? null;
    } catch (err) {
      console.warn("Failed to load config schema:", err);
    } finally {
      this.schemaLoading = false;
    }
  }

  private validateConfig(raw: string) {
    try {
      JSON.parse(raw);
      this.valid = true;
      this.issues = [];
    } catch {
      this.valid = false;
      this.issues = [{ message: "Invalid JSON" }];
    }
  }

  private async saveConfig() {
    this.saving = true;
    try {
      await gateway.call("config.save", { raw: this.raw });
      this.originalRaw = this.raw;
      if (this.formValue) {
        this.originalValue = structuredClone(this.formValue);
      }
    } catch (err) {
      this.issues = [{ message: err instanceof Error ? err.message : String(err) }];
    } finally {
      this.saving = false;
    }
  }

  private async applyConfig() {
    this.applying = true;
    try {
      await gateway.call("config.apply");
    } catch (err) {
      this.issues = [{ message: err instanceof Error ? err.message : String(err) }];
    } finally {
      this.applying = false;
    }
  }

  private async runUpdate() {
    this.updating = true;
    try {
      await gateway.call("config.update");
      await this.loadConfig();
    } catch (err) {
      this.issues = [{ message: err instanceof Error ? err.message : String(err) }];
    } finally {
      this.updating = false;
    }
  }
}
