/**
 * Providers Island - Interactive provider health & model management for Astro.
 * Wraps the existing renderProviders view with gateway service calls.
 */

import { StoreController } from "@nanostores/lit";
import { LitElement, html, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { gateway } from "../../services/gateway.ts";
import { $connected } from "../../stores/app.ts";
import type { AuthProviderEntry, OAuthFlowState } from "../controllers/auth.ts";
import type { ProviderHealthEntry } from "../controllers/providers-health.ts";
import { renderProviders, type ProvidersProps } from "../views/providers.ts";

@customElement("providers-island")
export class ProvidersIsland extends LitElement {
  private connectedCtrl = new StoreController(this, $connected);

  @state() private loading = false;
  @state() private error: string | null = null;
  @state() private entries: ProviderHealthEntry[] = [];
  @state() private updatedAt: number | null = null;
  @state() private showAll = false;
  @state() private expandedId: string | null = null;
  @state() private instanceCount = 0;
  @state() private sessionCount: number | null = null;
  @state() private agentRunning = false;
  @state() private modelAllowlist: Set<string> = new Set();
  @state() private primaryModel: string | null = null;
  @state() private modelFallbacks: string[] = [];
  @state() private modelsSaving = false;
  @state() private modelsCostFilter: "all" | "high" | "medium" | "low" | "free" = "all";
  @state() private authConfigProvider: string | null = null;
  @state() private authConfigSaving = false;
  @state() private authProvidersList: AuthProviderEntry[] | null = null;
  @state() private oauthFlow: OAuthFlowState | null = null;
  @state() private removingProvider: string | null = null;

  protected createRenderRoot() {
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
      const [healthResult, presenceResult, sessionsResult] = await Promise.all([
        gateway.call<{
          entries: ProviderHealthEntry[];
          updatedAt?: number;
          modelAllowlist?: string[];
          primaryModel?: string;
          modelFallbacks?: string[];
          agentRunning?: boolean;
        }>("providers.health"),
        gateway.call<{ entries: unknown[] }>("presence.list").catch(() => ({ entries: [] })),
        gateway.call<{ sessions: unknown[] }>("sessions.list").catch(() => ({ sessions: [] })),
      ]);

      this.entries = healthResult.entries ?? [];
      this.updatedAt = healthResult.updatedAt ?? Date.now();
      this.modelAllowlist = new Set(healthResult.modelAllowlist ?? []);
      this.primaryModel = healthResult.primaryModel ?? null;
      this.modelFallbacks = healthResult.modelFallbacks ?? [];
      this.agentRunning = healthResult.agentRunning ?? false;
      this.instanceCount = presenceResult.entries.length;
      this.sessionCount = sessionsResult.sessions.length;
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private async saveModels() {
    this.modelsSaving = true;
    try {
      await gateway.call("providers.saveModels", {
        allowlist: [...this.modelAllowlist],
        primary: this.primaryModel,
        fallbacks: this.modelFallbacks,
      });
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.modelsSaving = false;
    }
  }

  private toggleModel(key: string) {
    const next = new Set(this.modelAllowlist);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.modelAllowlist = next;
  }

  private setPrimary(key: string) {
    this.primaryModel = key;
  }

  private async saveCredential(
    provider: string,
    credential: string,
    credentialType: "api_key" | "token",
  ) {
    this.authConfigSaving = true;
    try {
      await gateway.call("auth.setCredential", { provider, credential, credentialType });
      this.authConfigProvider = null;
      await this.loadData();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.authConfigSaving = false;
    }
  }

  private async startOAuth(provider: string) {
    try {
      const res = await gateway.call<{
        flowId: string;
        authUrl?: string;
        needsCode?: boolean;
        codePromptMessage?: string;
      }>("auth.startOAuth", { provider });
      this.oauthFlow = {
        flowId: res.flowId,
        provider,
        status: "waiting",
        authUrl: res.authUrl,
        needsCode: res.needsCode,
        codePromptMessage: res.codePromptMessage,
      };
      if (res.authUrl) {
        window.open(res.authUrl, "_blank");
      }
    } catch (err) {
      this.oauthFlow = {
        flowId: "",
        provider,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async submitOAuthCode(code: string) {
    if (!this.oauthFlow) {
      return;
    }
    try {
      await gateway.call("auth.submitOAuthCode", {
        flowId: this.oauthFlow.flowId,
        code,
      });
      this.oauthFlow = { ...this.oauthFlow, status: "success" };
      await this.loadData();
    } catch (err) {
      this.oauthFlow = {
        ...this.oauthFlow,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async removeCredential(provider: string) {
    this.removingProvider = provider;
    try {
      await gateway.call("auth.removeCredential", { provider });
      await this.loadData();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.removingProvider = null;
    }
  }

  render(): TemplateResult {
    const props: ProvidersProps = {
      loading: this.loading,
      error: this.error,
      entries: this.entries,
      updatedAt: this.updatedAt,
      showAll: this.showAll,
      expandedId: this.expandedId,
      instanceCount: this.instanceCount,
      sessionCount: this.sessionCount,
      agentRunning: this.agentRunning,
      modelAllowlist: this.modelAllowlist,
      primaryModel: this.primaryModel,
      modelFallbacks: this.modelFallbacks,
      modelsSaving: this.modelsSaving,
      modelsCostFilter: this.modelsCostFilter,
      authConfigProvider: this.authConfigProvider,
      authConfigSaving: this.authConfigSaving,
      authProvidersList: this.authProvidersList,
      oauthFlow: this.oauthFlow,
      removingProvider: this.removingProvider,
      onRefresh: () => void this.loadData(),
      onToggleShowAll: () => {
        this.showAll = !this.showAll;
      },
      onToggleExpand: (id: string) => {
        this.expandedId = this.expandedId === id ? null : id;
      },
      onToggleModel: (key: string) => this.toggleModel(key),
      onSetPrimary: (key: string) => this.setPrimary(key),
      onSaveModels: () => void this.saveModels(),
      onCostFilterChange: (filter) => {
        this.modelsCostFilter = filter;
      },
      onConfigureProvider: (id: string | null) => {
        this.authConfigProvider = id;
      },
      onSaveCredential: (provider, credential, credentialType) =>
        void this.saveCredential(provider, credential, credentialType),
      onStartOAuth: (provider) => void this.startOAuth(provider),
      onCancelOAuth: () => {
        this.oauthFlow = null;
      },
      onSubmitOAuthCode: (code) => void this.submitOAuthCode(code),
      onRemoveCredential: (provider) => void this.removeCredential(provider),
    };

    return html`${renderProviders(props)}`;
  }
}
