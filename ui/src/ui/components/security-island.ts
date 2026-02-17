import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { gateway } from "../../services/gateway.ts";
import type {
  SecurityEvent,
  SecurityEventCategory,
  SecurityEventSeverity,
  SecurityEventStats,
  SecuritySummary,
  SecurityAuditReport,
} from "../controllers/security.ts";
import { renderSecurity, type SecurityProps } from "../views/security.ts";

@customElement("security-island")
export class SecurityIsland extends LitElement {
  @state() private loading = false;
  @state() private error: string | null = null;
  @state() private summary: SecuritySummary | null = null;
  @state() private stats: SecurityEventStats | null = null;
  @state() private events: SecurityEvent[] = [];
  @state() private alerts: SecurityEvent[] = [];
  @state() private blocked: SecurityEvent[] = [];
  @state() private audit: SecurityAuditReport | null = null;
  @state() private auditLoading = false;
  @state() private filterCategory: SecurityEventCategory | "all" = "all";
  @state() private filterSeverity: SecurityEventSeverity | "all" = "all";
  @state() private filterTimeRange: "1h" | "24h" | "7d" | "30d" | "all" = "24h";
  @state() private activeTab: "summary" | "events" | "alerts" | "blocked" | "audit" = "summary";
  @state() private eventsPage = 0;
  @state() private eventsPerPage = 50;

  createRenderRoot() {
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
      const result = await gateway.call<{
        summary: SecuritySummary;
        stats: SecurityEventStats;
        events: SecurityEvent[];
        alerts: SecurityEvent[];
        blocked: SecurityEvent[];
      }>("security.summary", {
        category: this.filterCategory,
        severity: this.filterSeverity,
        timeRange: this.filterTimeRange,
        page: this.eventsPage,
        limit: this.eventsPerPage,
      });
      this.summary = result.summary;
      this.stats = result.stats;
      this.events = result.events;
      this.alerts = result.alerts;
      this.blocked = result.blocked;
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private handleTabChange(tab: "summary" | "events" | "alerts" | "blocked" | "audit") {
    this.activeTab = tab;
    if (tab === "audit" && !this.audit) {
      void this.handleRunAudit(false);
    }
  }

  private handleFilterCategoryChange(category: SecurityEventCategory | "all") {
    this.filterCategory = category;
    this.eventsPage = 0;
    void this.loadData();
  }

  private handleFilterSeverityChange(severity: SecurityEventSeverity | "all") {
    this.filterSeverity = severity;
    this.eventsPage = 0;
    void this.loadData();
  }

  private handleFilterTimeRangeChange(range: "1h" | "24h" | "7d" | "30d" | "all") {
    this.filterTimeRange = range;
    this.eventsPage = 0;
    void this.loadData();
  }

  private async handleRunAudit(deep: boolean) {
    this.auditLoading = true;
    try {
      const result = await gateway.call<SecurityAuditReport>("security.audit", { deep });
      this.audit = result;
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.auditLoading = false;
    }
  }

  private handlePageChange(page: number) {
    this.eventsPage = Math.max(0, page);
    void this.loadData();
  }

  render() {
    const props: SecurityProps = {
      loading: this.loading,
      error: this.error,
      summary: this.summary,
      stats: this.stats,
      events: this.events,
      alerts: this.alerts,
      blocked: this.blocked,
      audit: this.audit,
      auditLoading: this.auditLoading,
      filterCategory: this.filterCategory,
      filterSeverity: this.filterSeverity,
      filterTimeRange: this.filterTimeRange,
      activeTab: this.activeTab,
      eventsPage: this.eventsPage,
      eventsPerPage: this.eventsPerPage,
      onRefresh: () => void this.loadData(),
      onTabChange: (tab) => this.handleTabChange(tab),
      onFilterCategoryChange: (category) => this.handleFilterCategoryChange(category),
      onFilterSeverityChange: (severity) => this.handleFilterSeverityChange(severity),
      onFilterTimeRangeChange: (range) => this.handleFilterTimeRangeChange(range),
      onRunAudit: (deep) => void this.handleRunAudit(deep),
      onPageChange: (page) => this.handlePageChange(page),
    };

    return html`${renderSecurity(props)}`;
  }
}
