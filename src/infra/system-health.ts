export type HealthStatus = "healthy" | "degraded" | "failed";

export interface SubsystemHealth {
  status: HealthStatus;
  lastError?: string;
  lastUpdated: number;
  failureCount: number;
}

export type SubsystemName = "hive" | "forge" | "cron" | "db";

const HEALTH_THRESHOLD = 3; // Consecutive failures for 'failed' status

const state: Record<SubsystemName, SubsystemHealth> = {
  hive: { status: "healthy", lastUpdated: Date.now(), failureCount: 0 },
  forge: { status: "healthy", lastUpdated: Date.now(), failureCount: 0 },
  cron: { status: "healthy", lastUpdated: Date.now(), failureCount: 0 },
  db: { status: "healthy", lastUpdated: Date.now(), failureCount: 0 },
};

export class SystemHealth {
  static update(subsystem: SubsystemName, error?: unknown) {
    const entry = state[subsystem];
    entry.lastUpdated = Date.now();

    if (error) {
      entry.failureCount++;
      entry.lastError = error instanceof Error ? error.message : String(error);
      entry.status = entry.failureCount >= HEALTH_THRESHOLD ? "failed" : "degraded";
    } else {
      entry.failureCount = 0;
      entry.status = "healthy";
      delete entry.lastError;
    }
  }

  static getHealthSummary() {
    return { ...state };
  }
}
