import type { AppViewState } from "../app-view-state.ts";

export type MissionControlJob = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  status: "pending" | "running" | "review" | "revising" | "done" | "failed" | "success";
  priority: number;
  agent_id: string | null;
  created_at: number;
  updated_at: number | null;
  started_at: number | null;
  finished_at: number | null;
  result_summary: string | null;
  error_message: string | null;
  tags: string | null;
  session_key: string | null;
  fail_count: number;
  verifier_last_confidence: number | null;
  pr_number: number | null;
  pr_url: string | null;
  revision_count: number;
};

export type MissionControlListResult = {
  ok: boolean;
  jobs: MissionControlJob[];
};

export async function loadMissionControlTasks(state: AppViewState): Promise<void> {
  if (!state.connected) {
    return;
  }

  state.missionControlLoading = true;
  state.missionControlError = null;

  try {
    const result = await state.client?.callMethod("missionControl.list", {});
    if (result?.ok && result.jobs) {
      state.missionControlTasks = result.jobs as MissionControlJob[];
    } else {
      state.missionControlError = "Failed to load tasks";
    }
  } catch (error) {
    state.missionControlError = String(error);
  } finally {
    state.missionControlLoading = false;
  }
}

export async function deleteMissionControlTask(state: AppViewState, taskId: string): Promise<void> {
  if (!state.connected) {
    return;
  }

  try {
    const result = await state.client?.callMethod("missionControl.delete", { id: taskId });
    if (result?.ok) {
      // Reload tasks after successful delete
      await loadMissionControlTasks(state);
    } else {
      state.missionControlError = "Failed to delete task";
    }
  } catch (error) {
    state.missionControlError = String(error);
  }
}
