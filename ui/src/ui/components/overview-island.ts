import { StoreController } from "@nanostores/lit";
import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { gateway } from "../../services/gateway.ts";
import { $connected } from "../../stores/app.ts";
import { $hello } from "../../stores/gateway.ts";
import type { SystemInfoResult } from "../controllers/system-info.ts";
import { loadSettings, saveSettings, type UiSettings } from "../storage.ts";
import type { PresenceEntry, CronStatus } from "../types.ts";
import { renderOverview, type OverviewProps } from "../views/overview.ts";

@customElement("overview-island")
export class OverviewIsland extends LitElement {
  private connectedCtrl = new StoreController(this, $connected);
  private helloCtrl = new StoreController(this, $hello);

  @state() private settings: UiSettings = loadSettings();
  @state() private password = "";
  @state() private lastError: string | null = null;
  @state() private presenceCount = 0;
  @state() private sessionsCount: number | null = null;
  @state() private cronEnabled: boolean | null = null;
  @state() private cronNext: number | null = null;
  @state() private lastChannelsRefresh: number | null = null;
  @state() private systemInfo: SystemInfoResult | null = null;

  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadData();
  }

  private async loadData() {
    try {
      const [presenceResult, sessionsResult, cronResult, systemResult] = await Promise.all([
        gateway.call<{ entries: PresenceEntry[] }>("presence.list").catch(() => ({ entries: [] })),
        gateway.call<{ sessions: unknown[] }>("sessions.list").catch(() => ({ sessions: [] })),
        gateway.call<CronStatus>("cron.status").catch(() => ({
          enabled: false,
          jobs: 0,
          nextWakeAtMs: null,
        })),
        gateway.call<SystemInfoResult>("system.info").catch(() => null),
      ]);

      this.presenceCount = presenceResult.entries.length;
      this.sessionsCount = sessionsResult.sessions.length;
      this.cronEnabled = cronResult.enabled;
      this.cronNext = cronResult.nextWakeAtMs ?? null;
      this.systemInfo = systemResult;
      this.lastError = null;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
    }
  }

  private handleSettingsChange(next: UiSettings) {
    this.settings = next;
    saveSettings(next);
  }

  private handlePasswordChange(next: string) {
    this.password = next;
  }

  private handleSessionKeyChange(next: string) {
    this.handleSettingsChange({ ...this.settings, sessionKey: next });
  }

  private async handleConnect() {
    try {
      await gateway.call("hello");
      await this.loadData();
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
    }
  }

  private async handleRefresh() {
    await this.loadData();
  }

  render() {
    const props: OverviewProps = {
      connected: this.connectedCtrl.value,
      hello: this.helloCtrl.value,
      settings: this.settings,
      password: this.password,
      lastError: this.lastError,
      presenceCount: this.presenceCount,
      sessionsCount: this.sessionsCount,
      cronEnabled: this.cronEnabled,
      cronNext: this.cronNext,
      lastChannelsRefresh: this.lastChannelsRefresh,
      systemInfo: this.systemInfo,
      onSettingsChange: (next) => this.handleSettingsChange(next),
      onPasswordChange: (next) => this.handlePasswordChange(next),
      onSessionKeyChange: (next) => this.handleSessionKeyChange(next),
      onConnect: () => void this.handleConnect(),
      onRefresh: () => void this.handleRefresh(),
    };

    return html`${renderOverview(props)}`;
  }
}
