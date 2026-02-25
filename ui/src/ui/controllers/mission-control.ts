import type { OpenClawApp } from "../app.ts";

export type MissionControlData = {
  tasks: any[];
  intel: any[];
  audit: any[];
  scheduled: any[];
  workspaces: any[];
};

export type MissionControlStats = {
  taskStats: { status: string; count: number }[];
  agentStats: { online: number; busy: number };
  tokens: number;
  cost: number;
  heartbeat: string;
};

export async function loadMissionControlData(app: OpenClawApp) {
  if (!app.client) return;

  try {
    const result = await app.client.call<MissionControlData>("mission_control.get_data", {});
    if (result) {
        app.missionControlData = result;
    }
  } catch (err) {
    console.error("Failed to load mission control data", err);
  }
}

export async function loadMissionControlStats(app: OpenClawApp) {
  if (!app.client) return;

  try {
    const result = await app.client.call<MissionControlStats>("mission_control.get_stats", {});
    if (result) {
        app.missionControlStats = result;
    }
  } catch (err) {
    console.error("Failed to load mission control stats", err);
  }
}

export async function loadSystemHealth(app: OpenClawApp) {
  if (!app.client) return;

  try {
    const result = await app.client.call<Record<string, any>>("mission_control.system_health", {});
    if (result) {
        app.systemHealth = result;
    }
  } catch (err) {
    console.error("Failed to load system health", err);
  }
}
