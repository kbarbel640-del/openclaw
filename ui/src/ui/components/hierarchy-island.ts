import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { gateway } from "../../services/gateway.ts";
import type { AgentHierarchyResult } from "../types.ts";
import { renderAgentsHierarchy, type AgentsHierarchyProps } from "../views/agents-hierarchy.ts";

@customElement("hierarchy-island")
export class HierarchyIsland extends LitElement {
  @state() private loading = false;
  @state() private error: string | null = null;
  @state() private data: AgentHierarchyResult | null = null;
  @state() private focusAgentId: string | undefined = undefined;

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
      const result = await gateway.call<AgentHierarchyResult>("agents.hierarchy");
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

  private handleNodeClick(sessionKey: string) {
    console.log("Node clicked:", sessionKey);
  }

  render() {
    const props: AgentsHierarchyProps = {
      loading: this.loading,
      error: this.error,
      data: this.data,
      focusAgentId: this.focusAgentId,
      onRefresh: () => void this.handleRefresh(),
      onNodeClick: (sk) => this.handleNodeClick(sk),
    };

    return html`${renderAgentsHierarchy(props)}`;
  }
}
