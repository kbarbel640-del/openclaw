import { html, nothing } from "lit";
import type { AppViewState } from "../app-view-state.ts";

export function renderWorkboards(state: AppViewState) {
  const tasks = state.missionControlData?.tasks || [];

  const getTasksByStatus = (status: string) => {
    return tasks.filter((t: any) => {
        const s = t.status.toLowerCase();
        if (status === 'Backlog') return s === 'pending' || s === 'todo';
        if (status === 'In Progress') return s === 'active' || s === 'in_progress';
        if (status === 'Review') return s === 'review' || s === 'blocked';
        if (status === 'Done') return s === 'completed' || s === 'done';
        return false;
    });
  };

  return html`
    <div class="p-6">
      <header class="flex justify-between items-center mb-8">
        <div>
          <h1 class="text-2xl font-bold">Work Orchestration</h1>
          <p class="text-muted-foreground">Manage tasks and team workflows</p>
        </div>
        <button class="btn btn-primary" @click=${async () => {
          const title = prompt('Task Title');
          if (!title) return;
          const description = prompt('Description (optional)');
          try {
            await state.client?.call('mission_control.create_task', { title, description });
            alert('Task created successfully');
            // Refresh data
            window.dispatchEvent(new CustomEvent('refresh-mission-control'));
          } catch (err) {
            alert('Failed to create task: ' + String(err));
          }
        }}>+ New Task</button>
      </header>

      <div class="grid grid-cols-4 gap-6">
        <!-- Kanban Columns -->
        ${["Backlog", "In Progress", "Review", "Done"].map((col) => {
          const colTasks = getTasksByStatus(col);
          return html`
            <div class="kanban-col bg-secondary/30 p-4 rounded-xl min-h-[500px]">
              <h3 class="font-semibold mb-4 flex justify-between items-center">
                ${col}
                <span class="text-xs bg-muted px-2 py-0.5 rounded">${colTasks.length}</span>
              </h3>
              <div class="space-y-3">
                ${colTasks.map((task: any) => html`
                  <div class="task-card card p-3 cursor-grab active:cursor-grabbing hover:border-primary/50 transition border border-transparent shadow-sm">
                    <div class="text-sm font-medium">${task.title}</div>
                    <div class="flex justify-between items-center mt-3">
                      <span class="text-[10px] bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded">${task.agent_id || 'main'}</span>
                      <span class="text-[10px] text-muted-foreground">${task.priority === 1 ? '🔥' : ''}</span>
                    </div>
                  </div>
                `)}
                ${colTasks.length === 0 ? html`<div class="text-xs text-muted-foreground text-center py-8 border border-dashed rounded-lg">Empty</div>` : nothing}
              </div>
            </div>
          `;
        })}
      </div>
    </div>
  `;
}
