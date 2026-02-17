import { StoreController } from "@nanostores/lit";
import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { gateway } from "../../services/gateway.ts";
import { $connected } from "../../stores/app.ts";
import type { HealthData } from "../controllers/health.ts";
import { renderHealth, type HealthProps } from "../views/health.ts";

@customElement("health-island")
export class HealthIsland extends LitElement {
  private connectedCtrl = new StoreController(this, $connected);

  @state() private loading = false;
  @state() private error: string | null = null;
  @state() private data: HealthData | null = null;
  @state() private channels: Array<{ id: string; status: string }> = [];
  @state() private debugHealth: unknown = null;

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
      const [healthResult, channelsResult] = await Promise.all([
        gateway.call<HealthData>("health.check").catch(() => null),
        gateway
          .call<{ channels: Array<{ id: string; status: string }> }>("health.channels")
          .catch(() => ({ channels: [] })),
      ]);
      this.data = healthResult;
      this.channels = channelsResult.channels ?? [];
      this.debugHealth = healthResult;
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private async handleRefresh() {
    await this.loadData();
  }

  render() {
    const props: HealthProps = {
      loading: this.loading,
      error: this.error,
      data: this.data,
      channels: this.channels,
      connected: this.connectedCtrl.value,
      debugHealth: this.debugHealth,
      onRefresh: () => void this.handleRefresh(),
    };

    return html`${renderHealth(props)}`;
  }
}
