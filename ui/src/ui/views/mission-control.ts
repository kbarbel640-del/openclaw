import { html, nothing } from "lit";
import type { AppViewState } from "../app-view-state.ts";

export function renderMissionControl(state: AppViewState) {
  const stats = state.missionControlStats;
  const data = state.missionControlData;

  const taskStats = stats?.taskStats || [];
  const agentStats = stats?.agentStats || { online: 0, busy: 0 };

  const formatTokens = (n: number) => {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toString();
  };

  const getCount = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'pending') return taskStats.find(st => st.status === 'pending' || st.status === 'todo' || st.status === 'blocked')?.count || 0;
    if (s === 'active') return taskStats.find(st => st.status === 'active' || st.status === 'in_progress')?.count || 0;
    if (s === 'completed') return taskStats.find(st => st.status === 'completed' || st.status === 'done')?.count || 0;
    return 0;
  };

  return html`
    <div class="mission-control-dashboard space-y-6">
      <!-- Workspace Switcher -->
      <div class="flex gap-2 overflow-x-auto pb-2">
        <div class="workspace-pill workspace-pill--active">Main Workspace</div>
        ${(data?.workspaces || []).map((ws: any) => html`
          <div class="workspace-pill">${ws.name}</div>
        `)}
        <button class="workspace-pill opacity-50 text-xs">+ New</button>
      </div>

      <!-- Hero Section -->
      <premium-panel .hoverLift=${false} class="hero-gradient p-0 overflow-hidden">
        <div class="grid grid-cols-4 divide-x divide-white/10">
          <div class="p-6">
            <div class="text-xs uppercase opacity-70 font-semibold mb-2">Tasks</div>
            <div class="text-3xl font-bold">
              ${getCount('pending')} / ${getCount('active')} / ${getCount('completed')}
            </div>
          </div>
          <div class="p-6">
            <div class="text-xs uppercase opacity-70 font-semibold mb-2">Active Agents</div>
            <div class="flex items-center gap-3">
              <span class="status-dot status-dot--active"></span>
              <span class="text-3xl font-bold">${agentStats.online}</span>
            </div>
          </div>
          <div class="p-6">
            <div class="text-xs uppercase opacity-70 font-semibold mb-2">Tokens Today</div>
            <div class="text-3xl font-bold animate-counter">${formatTokens(stats?.tokens || 0)}</div>
          </div>
          <div class="p-6">
            <div class="text-xs uppercase opacity-70 font-semibold mb-2">Next Heartbeat</div>
            <div class="text-3xl font-bold">${stats?.heartbeat || 'N/A'}</div>
          </div>
        </div>
      </premium-panel>

      <div class="grid grid-cols-3 gap-6">
        <!-- Activity Feed -->
        <div class="col-span-2 space-y-4">
          <premium-panel title="Live Activity Feed">
             <div slot="header-action">
                <span class="status-dot status-dot--active"></span>
             </div>
             <div class="activity-feed space-y-3 overflow-y-auto max-h-[600px] pr-2">
                ${(data?.audit || []).map((item: any) => {
                  let severity = 'cron';
                  if (item.action.includes('error') || item.status === 'failed') severity = 'error';
                  if (item.action.includes('warning')) severity = 'warning';
                  if (item.status === 'success') severity = 'success';

                  return html`
                    <div class="activity-item activity-item--${severity} p-3 bg-white/5 rounded-lg border border-white/5">
                      <div class="flex justify-between items-start">
                        <div>
                          <div class="text-sm font-semibold">${item.action}</div>
                          <div class="text-xs text-muted-foreground mt-1">
                            ${item.actor_id || 'System'} ${item.resource ? `→ ${item.resource}` : ''}
                          </div>
                        </div>
                        <span class="text-[10px] opacity-50">${new Date(item.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  `;
                })}
                ${!(data?.audit?.length) ? html`<div class="text-muted-foreground text-sm p-4 text-center italic">No recent activity detected.</div>` : nothing}
             </div>
          </premium-panel>
        </div>

        <!-- Sidebar Intel & Health -->
        <div class="space-y-6">
          <premium-panel title="System Health">
            <div class="space-y-3">
              ${['hive', 'forge', 'cron', 'db'].map(module => {
                const health = state.systemHealth?.[module] || { status: 'healthy' };
                const isActive = health.status === 'healthy';
                const isDegraded = health.status === 'degraded';

                return html`
                  <div class="flex justify-between items-center text-sm">
                    <span class="capitalize font-medium">${module}</span>
                    <div class="flex items-center gap-2">
                      <span class="text-xs opacity-70 capitalize">${health.status}</span>
                      <span class="status-dot ${isActive ? 'status-dot--active' : (isDegraded ? 'status-dot--busy' : 'status-dot--offline')}"></span>
                    </div>
                  </div>
                `;
              })}
            </div>
          </premium-panel>

          <premium-panel title="User Intelligence">
            <div class="space-y-4">
              ${(data?.intel || []).map((item: any) => html`
                <div class="p-3 bg-white/5 rounded-lg border border-white/5">
                  <div class="text-sm font-medium mb-1">${item.key}</div>
                  <div class="text-xs text-muted-foreground line-clamp-2">${item.value}</div>
                  <div class="mt-2 h-1 w-full bg-white/10 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-500 rounded-full" style="width: ${(item.confidence_score || 0) * 100}%"></div>
                  </div>
                </div>
              `)}
              ${!(data?.intel?.length) ? html`<div class="text-muted-foreground text-sm text-center">No intelligence insights gathered.</div>` : nothing}
            </div>
          </premium-panel>
        </div>
      </div>
    </div>
  `;
}
