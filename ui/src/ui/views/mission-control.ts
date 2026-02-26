import { html, nothing } from "lit";
import type { AppViewState } from "../app-view-state.ts";
import { icons } from "../icons.ts";

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
    <div class="mesh-background"></div>

    <div class="mission-control-dashboard space-y-8 animate-in fade-in duration-700">

      <!-- Top Level Navigation / Workspace Context -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3 overflow-x-auto no-scrollbar py-2">
          <div class="workspace-pill workspace-pill--active flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_white]"></span>
            Main Mesh
          </div>
          ${(data?.workspaces || []).map((ws: any) => html`
            <div class="workspace-pill flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-white/30"></span>
              ${ws.name}
            </div>
          `)}
          <button class="workspace-pill border-dashed opacity-60 hover:opacity-100 flex items-center gap-1">
            <span class="text-lg leading-none">+</span>
            New Team
          </button>
        </div>

        <div class="hidden md:flex items-center gap-4 text-[10px] uppercase tracking-widest font-bold opacity-40">
          <span class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Orchestration Active
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            Forge Listening
          </span>
        </div>
      </div>

      <!-- High Impact Stats (Hero) -->
      <premium-panel variant="hero" class="hero-card shadow-2xl">
        <div class="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5">
          <div class="stat-card group">
            <div class="stat-label">System Tasks</div>
            <div class="flex items-baseline gap-1">
              <span class="stat-value">${getCount('active')}</span>
              <span class="text-xs opacity-40 font-medium">/ ${getCount('pending') + getCount('active')}</span>
            </div>
            <div class="mt-3 w-16 h-1 bg-white/5 rounded-full overflow-hidden">
               <div class="h-full bg-white/40 rounded-full" style="width: ${Math.min(100, (getCount('active') / (getCount('pending') + getCount('active') || 1)) * 100)}%"></div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Neural Units</div>
            <div class="flex items-center gap-2">
               <span class="stat-value text-green-400">${agentStats.online}</span>
               <div class="status-dot status-dot--active scale-125"></div>
            </div>
            <div class="text-[9px] opacity-40 mt-1">${agentStats.busy} processing now</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Cognitive Load</div>
            <div class="stat-value animate-counter">${formatTokens(stats?.tokens || 0)}</div>
            <div class="text-[9px] opacity-40 mt-1">Tokens this cycle</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Temporal Sync</div>
            <div class="stat-value">${stats?.heartbeat || '00:00'}</div>
            <div class="text-[9px] opacity-40 mt-1">Next Pulse</div>
          </div>
        </div>
      </premium-panel>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Activity Stream -->
        <div class="lg:col-span-2 space-y-4">
          <premium-panel title="Sub-Agent Activity Stream">
             <div slot="header-action" class="flex items-center gap-2">
                <span class="text-[10px] font-bold opacity-40 uppercase tracking-tighter">Live Monitor</span>
                <span class="status-dot status-dot--active"></span>
             </div>

             <div class="activity-feed space-y-1 overflow-y-auto max-h-[550px] pr-4 custom-scrollbar">
                ${(data?.audit || []).map((item: any) => {
                  let severity = 'cron';
                  let icon = icons.loader;
                  if (item.action.includes('error') || item.status === 'failed') {
                    severity = 'error';
                    icon = icons.bug;
                  } else if (item.action.includes('warning')) {
                    severity = 'warning';
                    icon = icons.zap;
                  } else if (item.status === 'success') {
                    severity = 'success';
                    icon = icons.check;
                  } else if (item.action.includes('agent')) {
                    icon = icons.messageSquare;
                  }

                  return html`
                    <div class="activity-item activity-item--${severity}">
                      <div class="flex gap-4 items-start">
                        <div class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/5 text-white/40">
                           <span class="w-4 h-4">${icon}</span>
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="flex justify-between items-start mb-0.5">
                            <div class="text-sm font-bold tracking-tight text-white/90 truncate">${item.action}</div>
                            <span class="text-[9px] font-mono opacity-30 whitespace-nowrap ml-2">${new Date(item.created_at).toLocaleTimeString([], {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                          </div>
                          <div class="text-[11px] text-white/50 flex items-center gap-1.5">
                            <span class="font-bold text-white/30 uppercase tracking-widest text-[9px]">${item.actor_id || 'SYSTEM'}</span>
                            ${item.resource ? html`
                              <span class="opacity-30">/</span>
                              <span class="truncate">${item.resource}</span>
                            ` : nothing}
                          </div>
                        </div>
                      </div>
                    </div>
                  `;
                })}
                ${!(data?.audit?.length) ? html`
                  <div class="flex flex-col items-center justify-center py-20 opacity-20">
                    <span class="w-12 h-12 mb-4">${icons.radio}</span>
                    <div class="text-sm font-medium">Listening for events...</div>
                  </div>
                ` : nothing}
             </div>
          </premium-panel>
        </div>

        <!-- Intelligence & Health Sidebar -->
        <div class="space-y-8">

          <!-- System Vitals -->
          <premium-panel title="System Vitals">
            <div class="grid grid-cols-1 gap-4">
              ${['hive', 'forge', 'cron', 'db'].map(module => {
                const health = state.systemHealth?.[module] || { status: 'healthy' };
                const isActive = health.status === 'healthy';
                const isDegraded = health.status === 'degraded';

                let colorClass = 'text-green-400';
                let dotClass = 'status-dot--active';
                let bgClass = 'bg-green-500/10';

                if (!isActive) {
                  colorClass = isDegraded ? 'text-amber-400' : 'text-slate-500';
                  dotClass = isDegraded ? 'status-dot--busy' : 'status-dot--offline';
                  bgClass = isDegraded ? 'bg-amber-500/10' : 'bg-slate-500/10';
                }

                return html`
                  <div class="flex items-center justify-between p-3 rounded-xl border border-white/5 ${bgClass} transition-all hover:bg-white/5 group">
                    <div class="flex items-center gap-3">
                      <div class="w-2 h-2 rounded-full ${dotClass}"></div>
                      <span class="text-xs font-bold uppercase tracking-widest opacity-80 group-hover:opacity-100 transition-opacity">${module}</span>
                    </div>
                    <span class="text-[10px] font-mono font-bold ${colorClass}">${health.status.toUpperCase()}</span>
                  </div>
                `;
              })}
            </div>
          </premium-panel>

          <!-- Insight Panel -->
          <premium-panel title="User Intelligence">
            <div class="space-y-4">
              ${(data?.intel || []).slice(0, 5).map((item: any) => html`
                <div class="intel-card group">
                  <div class="flex justify-between items-center mb-2">
                    <div class="text-[10px] font-bold uppercase tracking-widest text-blue-400 opacity-80">${item.key}</div>
                    <span class="text-[9px] font-mono opacity-30">${Math.round((item.confidence_score || 0) * 100)}% Match</span>
                  </div>
                  <div class="text-xs text-white/60 line-clamp-2 leading-relaxed group-hover:text-white/90 transition-colors">${item.value}</div>
                  <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: ${(item.confidence_score || 0) * 100}%"></div>
                  </div>
                </div>
              `)}

              ${!(data?.intel?.length) ? html`
                <div class="py-8 text-center">
                   <div class="w-10 h-10 mx-auto mb-3 opacity-10">${icons.brain}</div>
                   <div class="text-[10px] uppercase font-bold opacity-30">Awaiting Data Habits</div>
                </div>
              ` : nothing}

              <button class="w-full py-2.5 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold uppercase tracking-widest opacity-50 hover:opacity-100 hover:bg-white/10 transition-all">
                Full Intel Report
              </button>
            </div>
          </premium-panel>

          <!-- Forge Activity Hint -->
          <div class="p-5 rounded-3xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20 backdrop-blur-xl relative overflow-hidden group">
             <div class="relative z-10">
               <div class="flex items-center gap-2 mb-2">
                 <span class="w-4 h-4 text-purple-400">${icons.zap}</span>
                 <span class="text-[10px] font-black uppercase tracking-[0.2em] text-purple-300">Forge Status</span>
               </div>
               <div class="text-xs text-white/70 leading-relaxed">
                 Forge is currently <span class="text-white font-bold">listening</span> for task failures to synthesize new skills.
               </div>
             </div>
             <div class="absolute -right-4 -bottom-4 w-24 h-24 bg-purple-500/10 blur-3xl rounded-full group-hover:scale-150 transition-transform duration-1000"></div>
          </div>

        </div>
      </div>
    </div>
  `;
}
