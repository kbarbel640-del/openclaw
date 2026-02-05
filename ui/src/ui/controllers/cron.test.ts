import { describe, expect, it } from "vitest";
import type { CronJob } from "../types.ts";
import {
  getFilteredCronJobs,
  setCronFilter,
  resetCronFilter,
  DEFAULT_CRON_FILTER,
  type CronState,
} from "./cron.ts";

function createState(jobs: CronJob[] = []): CronState {
  return {
    client: null,
    connected: false,
    cronLoading: false,
    cronJobs: jobs,
    cronStatus: null,
    cronError: null,
    cronForm: {
      name: "",
      description: "",
      agentId: "",
      enabled: true,
      scheduleKind: "every",
      everyAmount: "1",
      everyUnit: "minutes",
      scheduleAt: "",
      cronExpr: "",
      cronTz: "",
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payloadKind: "systemEvent",
      payloadText: "",
      deliveryMode: "announce",
      deliveryChannel: "",
      deliveryTo: "",
      timeoutSeconds: "",
    },
    cronRunsJobId: null,
    cronRuns: [],
    cronBusy: false,
    cronFilter: { ...DEFAULT_CRON_FILTER },
  };
}

function createJob(id: string, overrides: Partial<CronJob> = {}): CronJob {
  return {
    id,
    name: "Test Job",
    enabled: true,
    createdAtMs: 0,
    updatedAtMs: 0,
    schedule: { kind: "every", everyMs: 60000 },
    sessionTarget: "main",
    wakeMode: "next-heartbeat",
    payload: { kind: "systemEvent", text: "test" },
    ...overrides,
  };
}

describe("cron controller", () => {
  describe("getFilteredCronJobs", () => {
    it("returns all jobs when no filters are active", () => {
      const jobs = [
        createJob("job-1", { name: "Job One", enabled: true }),
        createJob("job-2", { name: "Job Two", enabled: false }),
      ];
      const state = createState(jobs);

      const filtered = getFilteredCronJobs(state);

      expect(filtered).toHaveLength(2);
    });

    it("filters by enabled status", () => {
      const jobs = [
        createJob("job-1", { name: "Job One", enabled: true }),
        createJob("job-2", { name: "Job Two", enabled: false }),
        createJob("job-3", { name: "Job Three", enabled: true }),
      ];
      const state = createState(jobs);
      state.cronFilter.enabled = "enabled";

      const filtered = getFilteredCronJobs(state);

      expect(filtered).toHaveLength(2);
      expect(filtered.every((job) => job.enabled)).toBe(true);
    });

    it("filters by disabled status", () => {
      const jobs = [
        createJob("job-1", { name: "Job One", enabled: true }),
        createJob("job-2", { name: "Job Two", enabled: false }),
        createJob("job-3", { name: "Job Three", enabled: false }),
      ];
      const state = createState(jobs);
      state.cronFilter.enabled = "disabled";

      const filtered = getFilteredCronJobs(state);

      expect(filtered).toHaveLength(2);
      expect(filtered.every((job) => !job.enabled)).toBe(true);
    });

    it("filters by schedule kind", () => {
      const jobs = [
        createJob("job-1", {
          name: "Job One",
          schedule: { kind: "at", at: "2024-01-01T00:00:00Z" },
        }),
        createJob("job-2", { name: "Job Two", schedule: { kind: "every", everyMs: 60000 } }),
        createJob("job-3", { name: "Job Three", schedule: { kind: "cron", expr: "0 9 * * *" } }),
      ];
      const state = createState(jobs);
      state.cronFilter.scheduleKind = "cron";

      const filtered = getFilteredCronJobs(state);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].schedule.kind).toBe("cron");
    });

    it("filters by last status", () => {
      const jobs = [
        createJob("job-1", {
          name: "Job One",
          state: { lastStatus: "ok", lastRunAtMs: 1000 },
        }),
        createJob("job-2", {
          name: "Job Two",
          state: { lastStatus: "error", lastRunAtMs: 2000 },
        }),
        createJob("job-3", {
          name: "Job Three",
          state: { lastStatus: "ok", lastRunAtMs: 3000 },
        }),
      ];
      const state = createState(jobs);
      state.cronFilter.lastStatus = "error";

      const filtered = getFilteredCronJobs(state);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].state?.lastStatus).toBe("error");
    });

    it("filters by search text (name)", () => {
      const jobs = [
        createJob("job-1", { name: "Daily Backup" }),
        createJob("job-2", { name: "Weekly Report" }),
        createJob("job-3", { name: "Daily Cleanup" }),
      ];
      const state = createState(jobs);
      state.cronFilter.searchText = "daily";

      const filtered = getFilteredCronJobs(state);

      expect(filtered).toHaveLength(2);
      expect(filtered.every((job) => job.name.toLowerCase().includes("daily"))).toBe(true);
    });

    it("filters by search text (job ID)", () => {
      const jobs = [
        createJob("backup-123", { name: "Backup" }),
        createJob("report-456", { name: "Report" }),
        createJob("cleanup-789", { name: "Cleanup" }),
      ];
      const state = createState(jobs);
      state.cronFilter.searchText = "456";

      const filtered = getFilteredCronJobs(state);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("report-456");
    });

    it("filters case-insensitively", () => {
      const jobs = [
        createJob("job-1", { name: "Daily Backup" }),
        createJob("job-2", { name: "WEEKLY REPORT" }),
        createJob("job-3", { name: "daily cleanup" }),
      ];
      const state = createState(jobs);
      state.cronFilter.searchText = "DAILY";

      const filtered = getFilteredCronJobs(state);

      expect(filtered).toHaveLength(2);
    });

    it("combines multiple filters", () => {
      const jobs = [
        createJob("job-1", {
          name: "Daily Backup",
          enabled: true,
          schedule: { kind: "cron", expr: "0 9 * * *" },
          state: { lastStatus: "ok", lastRunAtMs: 1000 },
        }),
        createJob("job-2", {
          name: "Daily Backup",
          enabled: false,
          schedule: { kind: "cron", expr: "0 9 * * *" },
          state: { lastStatus: "error", lastRunAtMs: 2000 },
        }),
        createJob("job-3", {
          name: "Weekly Report",
          enabled: true,
          schedule: { kind: "every", everyMs: 604800000 },
          state: { lastStatus: "ok", lastRunAtMs: 3000 },
        }),
      ];
      const state = createState(jobs);
      state.cronFilter.enabled = "enabled";
      state.cronFilter.scheduleKind = "cron";
      state.cronFilter.searchText = "daily";

      const filtered = getFilteredCronJobs(state);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("job-1");
    });

    it("excludes jobs without last status when filtering by last status", () => {
      const jobs = [
        createJob("job-1", {
          name: "Job One",
          state: { lastStatus: "ok", lastRunAtMs: 1000 },
        }),
        createJob("job-2", { name: "Job Two" }), // No state
      ];
      const state = createState(jobs);
      state.cronFilter.lastStatus = "ok";

      const filtered = getFilteredCronJobs(state);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("job-1");
    });
  });

  describe("setCronFilter", () => {
    it("updates filter state", () => {
      const state = createState();

      setCronFilter(state, { enabled: "enabled" });

      expect(state.cronFilter.enabled).toBe("enabled");
    });

    it("merges partial updates", () => {
      const state = createState();
      state.cronFilter.scheduleKind = "cron";
      state.cronFilter.searchText = "test";

      setCronFilter(state, { enabled: "disabled" });

      expect(state.cronFilter.enabled).toBe("disabled");
      expect(state.cronFilter.scheduleKind).toBe("cron");
      expect(state.cronFilter.searchText).toBe("test");
    });
  });

  describe("resetCronFilter", () => {
    it("resets all filters to defaults", () => {
      const state = createState();
      state.cronFilter.enabled = "enabled";
      state.cronFilter.scheduleKind = "cron";
      state.cronFilter.lastStatus = "error";
      state.cronFilter.searchText = "test";

      resetCronFilter(state);

      expect(state.cronFilter).toEqual(DEFAULT_CRON_FILTER);
    });
  });
});
