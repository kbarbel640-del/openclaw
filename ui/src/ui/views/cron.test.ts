import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import type { CronFilterState } from "../controllers/cron.ts";
import type { CronJob } from "../types.ts";
import { DEFAULT_CRON_FORM } from "../app-defaults.ts";
import { renderCron, type CronProps } from "./cron.ts";

function createJob(id: string): CronJob {
  return {
    id,
    name: "Daily ping",
    enabled: true,
    createdAtMs: 0,
    updatedAtMs: 0,
    schedule: { kind: "cron", expr: "0 9 * * *" },
    sessionTarget: "main",
    wakeMode: "next-heartbeat",
    payload: { kind: "systemEvent", text: "ping" },
  };
}

function createProps(overrides: Partial<CronProps> = {}): CronProps {
  return {
    loading: false,
    status: null,
    jobs: [],
    error: null,
    busy: false,
    form: { ...DEFAULT_CRON_FORM },
    channels: [],
    channelLabels: {},
    runsJobId: null,
    runs: [],
    filter: {
      enabled: "all",
      scheduleKind: "all",
      lastStatus: "all",
      searchText: "",
    },
    onFormChange: () => undefined,
    onRefresh: () => undefined,
    onAdd: () => undefined,
    onToggle: () => undefined,
    onRun: () => undefined,
    onRemove: () => undefined,
    onLoadRuns: () => undefined,
    onFilterChange: () => undefined,
    onFilterReset: () => undefined,
    ...overrides,
  };
}

describe("cron view", () => {
  it("prompts to select a job before showing run history", () => {
    const container = document.createElement("div");
    render(renderCron(createProps()), container);

    expect(container.textContent).toContain("Select a job to inspect run history.");
  });

  it("loads run history when clicking a job row", () => {
    const container = document.createElement("div");
    const onLoadRuns = vi.fn();
    const job = createJob("job-1");
    render(
      renderCron(
        createProps({
          jobs: [job],
          onLoadRuns,
        }),
      ),
      container,
    );

    const row = container.querySelector(".list-item-clickable");
    expect(row).not.toBeNull();
    row?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onLoadRuns).toHaveBeenCalledWith("job-1");
  });

  it("marks the selected job and keeps Runs button to a single call", () => {
    const container = document.createElement("div");
    const onLoadRuns = vi.fn();
    const job = createJob("job-1");
    render(
      renderCron(
        createProps({
          jobs: [job],
          runsJobId: "job-1",
          onLoadRuns,
        }),
      ),
      container,
    );

    const selected = container.querySelector(".list-item-selected");
    expect(selected).not.toBeNull();

    const runsButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "Runs",
    );
    expect(runsButton).not.toBeUndefined();
    runsButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onLoadRuns).toHaveBeenCalledTimes(1);
    expect(onLoadRuns).toHaveBeenCalledWith("job-1");
  });

  describe("filter bar", () => {
    it("renders filter controls above the jobs list", () => {
      const container = document.createElement("div");
      render(renderCron(createProps({ jobs: [createJob("job-1")] })), container);

      expect(container.textContent).toContain("Search");
      expect(container.textContent).toContain("Status");
      expect(container.textContent).toContain("Schedule");
      expect(container.textContent).toContain("Last run");
      expect(container.textContent).toContain("Reset");
    });

    it("calls onFilterChange when search text changes", () => {
      const container = document.createElement("div");
      const onFilterChange = vi.fn();
      render(
        renderCron(
          createProps({
            jobs: [createJob("job-1")],
            onFilterChange,
          }),
        ),
        container,
      );

      const searchInput = container.querySelector('input[type="text"]');
      expect(searchInput).not.toBeNull();

      searchInput?.dispatchEvent(
        new Event("input", {
          bubbles: true,
        }),
      );

      expect(onFilterChange).toHaveBeenCalled();
    });

    it("calls onFilterChange when status filter changes", () => {
      const container = document.createElement("div");
      const onFilterChange = vi.fn();
      render(
        renderCron(
          createProps({
            jobs: [createJob("job-1")],
            onFilterChange,
          }),
        ),
        container,
      );

      const statusSelect = Array.from(container.querySelectorAll("select")).find(
        (select) => select.previousElementSibling?.textContent === "Status",
      );
      expect(statusSelect).not.toBeNull();

      statusSelect?.dispatchEvent(
        new Event("change", {
          bubbles: true,
        }),
      );

      expect(onFilterChange).toHaveBeenCalled();
    });

    it("calls onFilterChange when schedule filter changes", () => {
      const container = document.createElement("div");
      const onFilterChange = vi.fn();
      render(
        renderCron(
          createProps({
            jobs: [createJob("job-1")],
            onFilterChange,
          }),
        ),
        container,
      );

      const scheduleSelect = Array.from(container.querySelectorAll("select")).find(
        (select) => select.previousElementSibling?.textContent === "Schedule",
      );
      expect(scheduleSelect).not.toBeNull();

      scheduleSelect?.dispatchEvent(
        new Event("change", {
          bubbles: true,
        }),
      );

      expect(onFilterChange).toHaveBeenCalled();
    });

    it("calls onFilterChange when last run filter changes", () => {
      const container = document.createElement("div");
      const onFilterChange = vi.fn();
      render(
        renderCron(
          createProps({
            jobs: [createJob("job-1")],
            onFilterChange,
          }),
        ),
        container,
      );

      const lastRunSelect = Array.from(container.querySelectorAll("select")).find(
        (select) => select.previousElementSibling?.textContent === "Last run",
      );
      expect(lastRunSelect).not.toBeNull();

      lastRunSelect?.dispatchEvent(
        new Event("change", {
          bubbles: true,
        }),
      );

      expect(onFilterChange).toHaveBeenCalled();
    });

    it("calls onFilterReset when reset button is clicked", () => {
      const container = document.createElement("div");
      const onFilterReset = vi.fn();
      const filter: CronFilterState = {
        enabled: "enabled",
        scheduleKind: "cron",
        lastStatus: "ok",
        searchText: "test",
      };
      render(
        renderCron(
          createProps({
            jobs: [createJob("job-1")],
            filter,
            onFilterReset,
          }),
        ),
        container,
      );

      const resetButton = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.trim() === "Reset",
      );
      expect(resetButton).not.toBeNull();

      resetButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      expect(onFilterReset).toHaveBeenCalled();
    });

    it("disables reset button when no filters are active", () => {
      const container = document.createElement("div");
      const filter: CronFilterState = {
        enabled: "all",
        scheduleKind: "all",
        lastStatus: "all",
        searchText: "",
      };
      render(
        renderCron(
          createProps({
            jobs: [createJob("job-1")],
            filter,
          }),
        ),
        container,
      );

      const resetButton = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.trim() === "Reset",
      );
      expect(resetButton).not.toBeNull();
      expect(resetButton?.getAttribute("disabled")).not.toBeNull();
    });

    it("enables reset button when filters are active", () => {
      const container = document.createElement("div");
      const filter: CronFilterState = {
        enabled: "enabled",
        scheduleKind: "all",
        lastStatus: "all",
        searchText: "",
      };
      render(
        renderCron(
          createProps({
            jobs: [createJob("job-1")],
            filter,
          }),
        ),
        container,
      );

      const resetButton = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent?.trim() === "Reset",
      );
      expect(resetButton).not.toBeNull();
      expect(resetButton?.getAttribute("disabled")).toBeNull();
    });
  });
});
