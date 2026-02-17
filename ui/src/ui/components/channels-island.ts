/**
 * Channels Island - Interactive channel management for Astro.
 * Wraps the existing renderChannels view with gateway service calls.
 */

import { StoreController } from "@nanostores/lit";
import { LitElement, html, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { gateway } from "../../services/gateway.ts";
import { $connected } from "../../stores/app.ts";
import type { ChannelsStatusSnapshot, ConfigUiHints, NostrProfile } from "../types.ts";
import {
  createNostrProfileFormState,
  type NostrProfileFormState,
} from "../views/channels.nostr-profile-form.ts";
import { renderChannels } from "../views/channels.ts";
import type { ChannelsProps } from "../views/channels.types.ts";

@customElement("channels-island")
export class ChannelsIsland extends LitElement {
  private connectedCtrl = new StoreController(this, $connected);

  @state() private loading = false;
  @state() private snapshot: ChannelsStatusSnapshot | null = null;
  @state() private lastError: string | null = null;
  @state() private lastSuccessAt: number | null = null;
  @state() private whatsappMessage: string | null = null;
  @state() private whatsappQrDataUrl: string | null = null;
  @state() private whatsappConnected: boolean | null = null;
  @state() private whatsappBusy = false;
  @state() private configSchema: unknown = null;
  @state() private configSchemaLoading = false;
  @state() private configForm: Record<string, unknown> | null = null;
  @state() private configUiHints: ConfigUiHints = {};
  @state() private configSaving = false;
  @state() private configFormDirty = false;
  @state() private nostrProfileFormState: NostrProfileFormState | null = null;
  @state() private nostrProfileAccountId: string | null = null;

  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadChannels(false);
  }

  private async loadChannels(probe: boolean) {
    this.loading = true;
    this.lastError = null;
    try {
      const res = await gateway.call<ChannelsStatusSnapshot | null>("channels.status", {
        probe,
        timeoutMs: 8000,
      });
      this.snapshot = res;
      this.lastSuccessAt = Date.now();
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private async startWhatsApp(force: boolean) {
    if (this.whatsappBusy) {
      return;
    }
    this.whatsappBusy = true;
    try {
      const res = await gateway.call<{ message?: string; qrDataUrl?: string }>("web.login.start", {
        force,
        timeoutMs: 30000,
      });
      this.whatsappMessage = res.message ?? null;
      this.whatsappQrDataUrl = res.qrDataUrl ?? null;
      this.whatsappConnected = null;
    } catch (err) {
      this.whatsappMessage = err instanceof Error ? err.message : String(err);
      this.whatsappQrDataUrl = null;
      this.whatsappConnected = null;
    } finally {
      this.whatsappBusy = false;
    }
  }

  private async waitWhatsApp() {
    if (this.whatsappBusy) {
      return;
    }
    this.whatsappBusy = true;
    try {
      const res = await gateway.call<{ message?: string; connected?: boolean }>("web.login.wait", {
        timeoutMs: 120000,
      });
      this.whatsappMessage = res.message ?? null;
      this.whatsappConnected = res.connected ?? null;
      if (res.connected) {
        this.whatsappQrDataUrl = null;
      }
    } catch (err) {
      this.whatsappMessage = err instanceof Error ? err.message : String(err);
      this.whatsappConnected = null;
    } finally {
      this.whatsappBusy = false;
    }
  }

  private async logoutWhatsApp() {
    if (this.whatsappBusy) {
      return;
    }
    this.whatsappBusy = true;
    try {
      await gateway.call("web.logout", {});
      this.whatsappMessage = "Logged out";
      this.whatsappQrDataUrl = null;
      this.whatsappConnected = false;
      await this.loadChannels(false);
    } catch (err) {
      this.whatsappMessage = err instanceof Error ? err.message : String(err);
    } finally {
      this.whatsappBusy = false;
    }
  }

  private handleConfigPatch(path: Array<string | number>, value: unknown) {
    if (!this.configForm) {
      return;
    }
    const updated = structuredClone(this.configForm);
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
    this.configForm = updated;
    this.configFormDirty = true;
  }

  private async saveConfig() {
    if (!this.configForm) {
      return;
    }
    this.configSaving = true;
    try {
      await gateway.call("config.save", { raw: JSON.stringify(this.configForm, null, 2) });
      this.configFormDirty = false;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
    } finally {
      this.configSaving = false;
    }
  }

  private async reloadConfig() {
    this.configSchemaLoading = true;
    try {
      const result = await gateway.call<{
        config?: Record<string, unknown>;
        uiHints?: ConfigUiHints;
        schema?: unknown;
      }>("config.get");
      this.configForm = result.config ?? null;
      this.configUiHints = result.uiHints ?? {};
      this.configFormDirty = false;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
    } finally {
      this.configSchemaLoading = false;
    }
  }

  private handleNostrProfileEdit(accountId: string, profile: NostrProfile | null) {
    this.nostrProfileAccountId = accountId;
    this.nostrProfileFormState = createNostrProfileFormState(profile ?? undefined);
  }

  private handleNostrProfileFieldChange(field: keyof NostrProfile, value: string) {
    if (!this.nostrProfileFormState) {
      return;
    }
    this.nostrProfileFormState = {
      ...this.nostrProfileFormState,
      values: { ...this.nostrProfileFormState.values, [field]: value },
    };
  }

  private async saveNostrProfile() {
    if (!this.nostrProfileFormState || !this.nostrProfileAccountId) {
      return;
    }
    try {
      await gateway.call("nostr.profile.update", {
        accountId: this.nostrProfileAccountId,
        profile: this.nostrProfileFormState,
      });
      this.nostrProfileFormState = null;
      this.nostrProfileAccountId = null;
      await this.loadChannels(false);
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
    }
  }

  private async importNostrProfile() {
    if (!this.nostrProfileAccountId) {
      return;
    }
    try {
      const res = await gateway.call<{ profile?: NostrProfile }>("nostr.profile.import", {
        accountId: this.nostrProfileAccountId,
      });
      if (res.profile) {
        this.handleNostrProfileEdit(this.nostrProfileAccountId, res.profile);
      }
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
    }
  }

  render(): TemplateResult {
    const props: ChannelsProps = {
      connected: this.connectedCtrl.value,
      loading: this.loading,
      snapshot: this.snapshot,
      lastError: this.lastError,
      lastSuccessAt: this.lastSuccessAt,
      whatsappMessage: this.whatsappMessage,
      whatsappQrDataUrl: this.whatsappQrDataUrl,
      whatsappConnected: this.whatsappConnected,
      whatsappBusy: this.whatsappBusy,
      configSchema: this.configSchema,
      configSchemaLoading: this.configSchemaLoading,
      configForm: this.configForm,
      configUiHints: this.configUiHints,
      configSaving: this.configSaving,
      configFormDirty: this.configFormDirty,
      nostrProfileFormState: this.nostrProfileFormState,
      nostrProfileAccountId: this.nostrProfileAccountId,
      onRefresh: (probe: boolean) => void this.loadChannels(probe),
      onWhatsAppStart: (force: boolean) => void this.startWhatsApp(force),
      onWhatsAppWait: () => void this.waitWhatsApp(),
      onWhatsAppLogout: () => void this.logoutWhatsApp(),
      onConfigPatch: (path, value) => this.handleConfigPatch(path, value),
      onConfigSave: () => void this.saveConfig(),
      onConfigReload: () => void this.reloadConfig(),
      onNostrProfileEdit: (accountId, profile) => this.handleNostrProfileEdit(accountId, profile),
      onNostrProfileCancel: () => {
        this.nostrProfileFormState = null;
        this.nostrProfileAccountId = null;
      },
      onNostrProfileFieldChange: (field, value) => this.handleNostrProfileFieldChange(field, value),
      onNostrProfileSave: () => void this.saveNostrProfile(),
      onNostrProfileImport: () => void this.importNostrProfile(),
      onNostrProfileToggleAdvanced: () => {
        if (!this.nostrProfileFormState) {
          return;
        }
        this.nostrProfileFormState = {
          ...this.nostrProfileFormState,
          showAdvanced: !this.nostrProfileFormState.showAdvanced,
        };
      },
    };

    return html`${renderChannels(props)}`;
  }
}
