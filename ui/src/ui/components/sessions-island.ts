import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { gateway } from "../../services/gateway.ts";
import type { SessionsListResult } from "../types.ts";
import { renderSessions, type SessionsProps } from "../views/sessions.ts";

@customElement("sessions-island")
export class SessionsIsland extends LitElement {
  @state() private loading = false;
  @state() private result: SessionsListResult | null = null;
  @state() private error: string | null = null;
  @state() private activeMinutes = "60";
  @state() private limit = "100";
  @state() private includeGlobal = true;
  @state() private includeUnknown = false;

  private basePath =
    (typeof globalThis.window !== "undefined"
      ? (window as { __OPENCLAW_CONTROL_UI_BASE_PATH__?: string }).__OPENCLAW_CONTROL_UI_BASE_PATH__
      : undefined) || "";

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadSessions();
  }

  private async loadSessions() {
    this.loading = true;
    this.error = null;
    try {
      const result = await gateway.call<SessionsListResult>("sessions.list", {
        activeMinutes: Number(this.activeMinutes),
        limit: Number(this.limit),
        includeGlobal: this.includeGlobal,
        includeUnknown: this.includeUnknown,
      });
      this.result = result;
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private handleFiltersChange(next: {
    activeMinutes: string;
    limit: string;
    includeGlobal: boolean;
    includeUnknown: boolean;
  }) {
    this.activeMinutes = next.activeMinutes;
    this.limit = next.limit;
    this.includeGlobal = next.includeGlobal;
    this.includeUnknown = next.includeUnknown;
    void this.loadSessions();
  }

  private async handlePatch(
    key: string,
    patch: {
      label?: string | null;
      thinkingLevel?: string | null;
      verboseLevel?: string | null;
      reasoningLevel?: string | null;
    },
  ) {
    try {
      await gateway.call("sessions.patch", { key, patch });
      await this.loadSessions();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private async handleDelete(key: string) {
    if (!confirm(`Delete session "${key}"?`)) {
      return;
    }
    try {
      await gateway.call("sessions.delete", { key });
      await this.loadSessions();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private async handlePreview(key: string) {
    try {
      const preview = await gateway.call("sessions.preview", { key });
      console.log("Session preview:", preview);
      alert(`Session preview logged to console`);
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private async handleReset(key: string) {
    if (!confirm(`Reset session "${key}"?`)) {
      return;
    }
    try {
      await gateway.call("sessions.reset", { key });
      await this.loadSessions();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private async handleCompact(key: string) {
    if (!confirm(`Compact session "${key}"?`)) {
      return;
    }
    try {
      await gateway.call("sessions.compact", { key });
      await this.loadSessions();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  render() {
    const props: SessionsProps = {
      loading: this.loading,
      result: this.result,
      error: this.error,
      activeMinutes: this.activeMinutes,
      limit: this.limit,
      includeGlobal: this.includeGlobal,
      includeUnknown: this.includeUnknown,
      basePath: this.basePath,
      onFiltersChange: (next) => this.handleFiltersChange(next),
      onRefresh: () => void this.loadSessions(),
      onPatch: (key, patch) => void this.handlePatch(key, patch),
      onDelete: (key) => void this.handleDelete(key),
      onPreview: (key) => void this.handlePreview(key),
      onReset: (key) => void this.handleReset(key),
      onCompact: (key) => void this.handleCompact(key),
    };

    return html`${renderSessions(props)}`;
  }
}
