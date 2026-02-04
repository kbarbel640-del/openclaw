/**
 * Auto-Submit State Persistence for DJ Web Operator
 *
 * Tracks daily and per-workflow auto-submit counts to enforce caps.
 * Persists across restarts using a local state file.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// =============================================================================
// Types
// =============================================================================

/**
 * Persisted state structure.
 */
export interface AutoSubmitState {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Count of auto-submits today */
  dailyCount: number;
  /** Active workflow states keyed by workflow ID */
  workflows: Record<string, WorkflowState>;
}

/**
 * Per-workflow state.
 */
export interface WorkflowState {
  /** Workflow ID */
  id: string;
  /** Count of auto-submits in this workflow */
  submitCount: number;
  /** When the workflow started */
  startedAt: string;
  /** URLs submitted to */
  submittedUrls: string[];
}

/**
 * Result of checking/recording an auto-submit.
 */
export interface AutoSubmitCheckResult {
  allowed: boolean;
  reason?: string;
  dailyCount: number;
  workflowCount: number;
  dailyCap: number;
  workflowCap: number;
}

// =============================================================================
// State File Management
// =============================================================================

/**
 * Get the default state file path.
 */
export function getStateFilePath(): string {
  const openclawDir = join(homedir(), ".openclaw");
  return join(openclawDir, "dj-web-autosubmit-state.json");
}

/**
 * Get today's date as ISO string (YYYY-MM-DD).
 */
export function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Load state from file.
 */
export function loadState(filePath: string = getStateFilePath()): AutoSubmitState {
  const today = getTodayDate();

  try {
    if (existsSync(filePath)) {
      const data = readFileSync(filePath, "utf-8");
      const state = JSON.parse(data) as AutoSubmitState;

      // Reset if it's a new day
      if (state.date !== today) {
        return {
          date: today,
          dailyCount: 0,
          workflows: {},
        };
      }

      return state;
    }
  } catch {
    // Ignore errors, return fresh state
  }

  return {
    date: today,
    dailyCount: 0,
    workflows: {},
  };
}

/**
 * Save state to file.
 */
export function saveState(state: AutoSubmitState, filePath: string = getStateFilePath()): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
}

// =============================================================================
// Auto-Submit State Manager
// =============================================================================

/**
 * Manages auto-submit state with cap enforcement.
 */
export class AutoSubmitStateManager {
  private state: AutoSubmitState;
  private filePath: string;
  private dailyCap: number;
  private workflowCap: number;

  constructor(
    options: {
      dailyCap?: number;
      workflowCap?: number;
      filePath?: string;
    } = {},
  ) {
    this.dailyCap = options.dailyCap ?? 3;
    this.workflowCap = options.workflowCap ?? 1;
    this.filePath = options.filePath ?? getStateFilePath();
    this.state = loadState(this.filePath);
  }

  /**
   * Refresh state from file (call before checking if external changes possible).
   */
  refresh(): void {
    this.state = loadState(this.filePath);
  }

  /**
   * Get current daily count.
   */
  getDailyCount(): number {
    this.ensureCurrentDay();
    return this.state.dailyCount;
  }

  /**
   * Get workflow submit count.
   */
  getWorkflowCount(workflowId: string): number {
    this.ensureCurrentDay();
    return this.state.workflows[workflowId]?.submitCount ?? 0;
  }

  /**
   * Check if an auto-submit is allowed.
   */
  checkAutoSubmit(workflowId: string): AutoSubmitCheckResult {
    this.ensureCurrentDay();

    const workflowState = this.state.workflows[workflowId];
    const workflowCount = workflowState?.submitCount ?? 0;

    // Check workflow cap
    if (workflowCount >= this.workflowCap) {
      return {
        allowed: false,
        reason: `Workflow cap reached (${workflowCount}/${this.workflowCap})`,
        dailyCount: this.state.dailyCount,
        workflowCount,
        dailyCap: this.dailyCap,
        workflowCap: this.workflowCap,
      };
    }

    // Check daily cap
    if (this.state.dailyCount >= this.dailyCap) {
      return {
        allowed: false,
        reason: `Daily cap reached (${this.state.dailyCount}/${this.dailyCap})`,
        dailyCount: this.state.dailyCount,
        workflowCount,
        dailyCap: this.dailyCap,
        workflowCap: this.workflowCap,
      };
    }

    return {
      allowed: true,
      dailyCount: this.state.dailyCount,
      workflowCount,
      dailyCap: this.dailyCap,
      workflowCap: this.workflowCap,
    };
  }

  /**
   * Record an auto-submit (only call if checkAutoSubmit returned allowed=true).
   */
  recordAutoSubmit(workflowId: string, url: string): AutoSubmitCheckResult {
    this.ensureCurrentDay();

    // Initialize workflow if needed
    if (!this.state.workflows[workflowId]) {
      this.state.workflows[workflowId] = {
        id: workflowId,
        submitCount: 0,
        startedAt: new Date().toISOString(),
        submittedUrls: [],
      };
    }

    // Increment counts
    this.state.dailyCount++;
    this.state.workflows[workflowId].submitCount++;
    this.state.workflows[workflowId].submittedUrls.push(url);

    // Persist
    saveState(this.state, this.filePath);

    return {
      allowed: true,
      dailyCount: this.state.dailyCount,
      workflowCount: this.state.workflows[workflowId].submitCount,
      dailyCap: this.dailyCap,
      workflowCap: this.workflowCap,
    };
  }

  /**
   * Start a new workflow.
   */
  startWorkflow(workflowId: string): void {
    this.ensureCurrentDay();

    this.state.workflows[workflowId] = {
      id: workflowId,
      submitCount: 0,
      startedAt: new Date().toISOString(),
      submittedUrls: [],
    };

    saveState(this.state, this.filePath);
  }

  /**
   * End a workflow (cleanup).
   */
  endWorkflow(workflowId: string): void {
    this.ensureCurrentDay();

    delete this.state.workflows[workflowId];
    saveState(this.state, this.filePath);
  }

  /**
   * Get all workflow IDs.
   */
  getWorkflowIds(): string[] {
    this.ensureCurrentDay();
    return Object.keys(this.state.workflows);
  }

  /**
   * Get workflow state.
   */
  getWorkflowState(workflowId: string): WorkflowState | null {
    this.ensureCurrentDay();
    return this.state.workflows[workflowId] ?? null;
  }

  /**
   * Get full state (for debugging/logging).
   */
  getState(): AutoSubmitState {
    this.ensureCurrentDay();
    return { ...this.state };
  }

  /**
   * Reset state (for testing).
   */
  reset(): void {
    this.state = {
      date: getTodayDate(),
      dailyCount: 0,
      workflows: {},
    };
    saveState(this.state, this.filePath);
  }

  /**
   * Ensure state is for current day, reset if not.
   */
  private ensureCurrentDay(): void {
    const today = getTodayDate();
    if (this.state.date !== today) {
      this.state = {
        date: today,
        dailyCount: 0,
        workflows: {},
      };
      saveState(this.state, this.filePath);
    }
  }
}

/**
 * Create a new auto-submit state manager.
 */
export function createAutoSubmitStateManager(options?: {
  dailyCap?: number;
  workflowCap?: number;
  filePath?: string;
}): AutoSubmitStateManager {
  return new AutoSubmitStateManager(options);
}
