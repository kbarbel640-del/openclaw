import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { gateway } from "../../services/gateway.ts";
import type { PresenceEntry } from "../types.ts";
import { renderInstances, type InstancesProps } from "../views/instances.ts";

@customElement("instances-island")
export class InstancesIsland extends LitElement {
  @state() private loading = false;
  @state() private entries: PresenceEntry[] = [];
  @state() private lastError: string | null = null;
  @state() private statusMessage: string | null = null;

  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadData();
  }

  private async loadData() {
    this.loading = true;
    this.lastError = null;
    this.statusMessage = null;
    try {
      const result = await gateway.call<{
        entries: PresenceEntry[];
        status?: string;
      }>("presence.list");
      this.entries = result.entries ?? [];
      this.statusMessage = result.status ?? null;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private async handleRefresh() {
    await this.loadData();
  }

  render() {
    const props: InstancesProps = {
      loading: this.loading,
      entries: this.entries,
      lastError: this.lastError,
      statusMessage: this.statusMessage,
      onRefresh: () => void this.handleRefresh(),
    };

    return html`${renderInstances(props)}`;
  }
}
