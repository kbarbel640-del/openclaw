import { html } from "lit";
import {
  TASK_STORE_KEY,
  laneLabel,
  loadTaskStore,
  saveTaskStore,
  sortByPriority,
  type TaskItem,
  type TaskLane,
  type TaskPriority,
} from "../tasks-store.ts";

function renderTaskList(tasks: TaskItem[]) {
  if (tasks.length === 0) {
    return html`<div class="muted">No tasks yet.</div>`;
  }
  return html`
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Priority</th>
            <th>Task</th>
            <th>Lane</th>
            <th>Agent</th>
            <th>Next Action</th>
            <th>Due</th>
          </tr>
        </thead>
        <tbody>
          ${tasks.map(
            (task) => html`
              <tr>
                <td><span class="mono">${task.priority}</span></td>
                <td>${task.title}</td>
                <td>${laneLabel(task.lane)}</td>
                <td><span class="mono">${task.assignedAgent || "unassigned"}</span></td>
                <td>${task.nextAction || "—"}</td>
                <td>${task.due || "—"}</td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    </div>
  `;
}

function promptNewTask(): TaskItem | null {
  const title = (window.prompt("Task title") || "").trim();
  if (!title) {
    return null;
  }
  const laneRaw = (window.prompt("Lane: client | notino | vectra", "client") || "client").trim();
  const lane: TaskLane =
    laneRaw === "notino" || laneRaw === "vectra" || laneRaw === "client" ? laneRaw : "client";
  const priorityRaw =
    (window.prompt("Priority: P0 | P1 | P2 | P3", "P2") || "P2").trim().toUpperCase();
  const priority: TaskPriority =
    priorityRaw === "P0" || priorityRaw === "P1" || priorityRaw === "P2" || priorityRaw === "P3"
      ? priorityRaw
      : "P2";
  const assignedAgent = (window.prompt("Assigned agent (optional)") || "").trim();
  const nextAction = (window.prompt("Next action (optional)") || "").trim();
  const due = (window.prompt("Due date/time (optional)") || "").trim();
  const showInChat =
    (window.prompt("Show in Active Tasks on chat? yes/no", "yes") || "yes").trim().toLowerCase() ===
    "yes";

  return {
    id: `task-${Date.now()}`,
    title,
    lane,
    priority,
    assignedAgent: assignedAgent || undefined,
    nextAction: nextAction || undefined,
    due: due || undefined,
    activeOnChat: showInChat,
  };
}

export function renderTasks() {
  const store = loadTaskStore();
  const topOutcomes = store.topOutcomes.slice(0, 3);
  const prioritized = sortByPriority(store.tasks);
  const byLane = {
    client: prioritized.filter((task) => task.lane === "client"),
    notino: prioritized.filter((task) => task.lane === "notino"),
    vectra: prioritized.filter((task) => task.lane === "vectra"),
  };

  return html`
    <section class="grid grid-cols-2">
      <div class="card" style="grid-column: 1 / -1;">
        <div class="row" style="justify-content: space-between; align-items: center;">
          <div>
            <div class="card-title">Current Endeavor</div>
            <div class="card-sub">Your main active mission right now.</div>
          </div>
          <button
            class="btn btn--sm"
            @click=${() => {
              const next = (window.prompt("Set current endeavor", store.currentEndeavor || "") || "").trim();
              const updated = { ...store, currentEndeavor: next };
              saveTaskStore(updated);
              window.location.reload();
            }}
          >
            Set Endeavor
          </button>
        </div>
        <div style="margin-top: 10px;">
          ${store.currentEndeavor
            ? html`<strong>${store.currentEndeavor}</strong>`
            : html`<span class="muted">No current endeavor set.</span>`}
        </div>
      </div>

      <div class="card">
        <div class="card-title">Weekly Top 3 Outcomes</div>
        <div class="card-sub">Locked outcomes for the current week.</div>
        <ol style="margin: 12px 0 0 18px; padding: 0;">
          ${topOutcomes.length > 0
            ? topOutcomes.map((outcome) => html`<li style="margin-bottom: 8px;">${outcome}</li>`)
            : html`<li class="muted">No outcomes saved yet.</li>`}
        </ol>
      </div>

      <div class="card">
        <div class="row" style="justify-content: space-between; align-items: center;">
          <div>
            <div class="card-title">Task Intake Model</div>
            <div class="card-sub">Create and visualize all tasks quickly.</div>
          </div>
          <button
            class="btn btn--sm"
            @click=${() => {
              const task = promptNewTask();
              if (!task) {
                return;
              }
              const updated = {
                ...store,
                tasks: [task, ...store.tasks],
              };
              saveTaskStore(updated);
              window.location.reload();
            }}
          >
            + New Task
          </button>
        </div>
        <ul style="margin: 12px 0 0 18px; padding: 0;">
          <li>GitHub issues</li>
          <li>Markdown task notes in repos</li>
          <li>Email-derived action items</li>
          <li>Google Drive shared docs</li>
        </ul>
        <div class="callout" style="margin-top: 14px;">
          Current local key: <span class="mono">${TASK_STORE_KEY}</span>
        </div>
      </div>

      <div class="card" style="grid-column: 1 / -1;">
        <div class="card-title">All Tasks</div>
        <div class="card-sub">Everything currently tracked.</div>
        ${renderTaskList(prioritized)}
      </div>

      <div class="card">
        <div class="card-title">Client Delivery Lane</div>
        ${renderTaskList(byLane.client)}
      </div>

      <div class="card">
        <div class="card-title">Notino Lane</div>
        ${renderTaskList(byLane.notino)}
      </div>

      <div class="card" style="grid-column: 1 / -1;">
        <div class="card-title">Vectra / Algovectra Lane</div>
        ${renderTaskList(byLane.vectra)}
      </div>
    </section>
  `;
}
