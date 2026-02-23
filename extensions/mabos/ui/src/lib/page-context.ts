type PageContext = {
  pageId: string;
  pageType: string;
  capabilities: string[];
};

const pageContextMap: Record<string, PageContext> = {
  "/": {
    pageId: "overview",
    pageType: "dashboard",
    capabilities: ["view_summary", "navigate"],
  },
  "/decisions": {
    pageId: "decisions",
    pageType: "decisions",
    capabilities: ["resolve_decision", "filter_decisions", "defer_decision"],
  },
  "/projects": {
    pageId: "projects",
    pageType: "projects",
    capabilities: ["update_task_status", "create_task", "reassign_task", "filter_tasks"],
  },
  "/goals": {
    pageId: "goals",
    pageType: "goals",
    capabilities: ["update_goal", "create_goal", "filter_goals"],
  },
  "/agents": {
    pageId: "agents",
    pageType: "agents",
    capabilities: ["create_agent", "trigger_bdi", "view_agent_detail", "filter_agents"],
  },
  "/workflows": {
    pageId: "workflows",
    pageType: "workflows",
    capabilities: ["restart_workflow", "pause_workflow", "filter_workflows"],
  },
  "/performance": {
    pageId: "performance",
    pageType: "metrics",
    capabilities: ["refresh_kpis", "compare_periods", "filter_metrics"],
  },
  "/inventory": {
    pageId: "inventory",
    pageType: "inventory",
    capabilities: ["check_stock", "reorder", "filter_inventory"],
  },
  "/accounting": {
    pageId: "accounting",
    pageType: "finance",
    capabilities: ["view_revenue", "view_invoices", "filter_transactions"],
  },
  "/hr": {
    pageId: "hr",
    pageType: "hr",
    capabilities: ["view_workload", "view_positions", "filter_employees"],
  },
  "/timeline": {
    pageId: "timeline",
    pageType: "timeline",
    capabilities: ["view_milestones", "filter_events"],
  },
  "/knowledge-graph": {
    pageId: "knowledge-graph",
    pageType: "knowledge",
    capabilities: ["view_dependencies", "find_nodes", "filter_graph"],
  },
};

const BASEPATH = "/mabos/dashboard";

export function getPageContext(pathname: string): PageContext {
  const relative = pathname.startsWith(BASEPATH)
    ? pathname.slice(BASEPATH.length) || "/"
    : pathname;
  return pageContextMap[relative] || pageContextMap["/"]!;
}
