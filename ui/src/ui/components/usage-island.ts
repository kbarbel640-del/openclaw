import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { gateway } from "../../services/gateway.ts";
import { renderUsage } from "../views/usage.ts";

type PeriodType = "24h" | "7d" | "30d" | "all";

function periodToDays(period: PeriodType): number {
  switch (period) {
    case "24h":
      return 1;
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "all":
      return 0;
  }
}

@customElement("usage-island")
export class UsageIsland extends LitElement {
  @state() private loading = false;
  @state() private error: string | null = null;
  @state() private status: unknown = null;
  @state() private cost: unknown = null;
  @state() private period: PeriodType = "24h";

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
      const days = periodToDays(this.period);
      const [statusResult, costResult] = await Promise.all([
        gateway.call("usage.status").catch(() => null),
        gateway.call("usage.cost", { days }).catch(() => null),
      ]);
      this.status = statusResult;
      this.cost = costResult;
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private async handlePeriodChange(period: PeriodType) {
    this.period = period;
    await this.loadData();
  }

  private async handleRefresh() {
    await this.loadData();
  }

  render() {
    const props = {
      loading: this.loading,
      error: this.error,
      status: this.status,
      cost: this.cost,
      period: this.period,
      onPeriodChange: (p: PeriodType) => void this.handlePeriodChange(p),
      onRefresh: () => void this.handleRefresh(),
    };

    return html`${renderUsage(props as unknown as Parameters<typeof renderUsage>[0])}`;
  }
}
