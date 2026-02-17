import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { gateway } from "../../services/gateway.ts";
import type { AgentResourcesResult } from "../controllers/agent-resources.ts";
import { renderResources, type ResourcesProps } from "../views/resources.ts";

@customElement("resources-island")
export class ResourcesIsland extends LitElement {
  @state() private loading = false;
  @state() private error: string | null = null;
  @state() private data: AgentResourcesResult | null = null;

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
      const result = await gateway.call<AgentResourcesResult>("agent-resources.list");
      this.data = result;
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
    const props: ResourcesProps = {
      loading: this.loading,
      error: this.error,
      data: this.data,
      onRefresh: () => void this.handleRefresh(),
    };

    return html`${renderResources(props)}`;
  }
}
