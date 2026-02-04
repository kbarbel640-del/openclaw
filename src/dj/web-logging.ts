/**
 * Web Logging for DJ Web Operator
 *
 * Structured logging for web operations with optional Notion audit trail.
 * By default, logs field names but NOT field values for privacy.
 */

import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { NotionService } from "./notion/notion-service.js";
import type { WebOpsLogEntry } from "./notion/types.js";
import type { ActionClass, DenyRuleResult, PolicyDecision } from "./web-policy.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Log entry for a web operation.
 */
export interface WebOperationLog {
  /** Unique log entry ID */
  id: string;
  /** Workflow ID */
  workflowId: string;
  /** Timestamp */
  timestamp: string;
  /** Budget profile used */
  profile: "cheap" | "normal" | "deep";
  /** Task description */
  task: string;
  /** Outcome */
  outcome: "success" | "failure" | "paused" | "cancelled" | "budget_exceeded";
  /** Error message if failed */
  error?: string;
  /** URLs visited during operation */
  visitedUrls: string[];
  /** Actions taken */
  actions: WebActionLog[];
  /** Total duration in milliseconds */
  durationMs: number;
  /** Budget usage */
  budgetUsage?: {
    toolCalls: number;
    tokens: number;
    costUsd: number;
  };
}

/**
 * Log entry for a single action.
 */
export interface WebActionLog {
  /** Action sequence number */
  sequence: number;
  /** Action type */
  type: "navigate" | "click" | "fill" | "submit" | "wait" | "snapshot";
  /** URL where action was performed */
  url: string;
  /** Action classification */
  actionClass?: ActionClass;
  /** Whether auto-submit was used */
  autoSubmitted?: boolean;
  /** Whether approval was required */
  approvalRequired?: boolean;
  /** Approval ID if paused */
  approvalId?: string;
  /** Deny rule result if denied */
  denyResult?: DenyRuleResult;
  /** Policy decision reason */
  policyReason?: string;
  /** Field names involved (no values by default) */
  fieldNames?: string[];
  /** Button/element text clicked */
  elementText?: string;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Error if action failed */
  error?: string;
}

/**
 * Notion WebOps Log entry.
 */
export interface NotionWebOpsLogEntry {
  /** Workflow ID (for reference) */
  workflowId: string;
  /** Task summary */
  task: string;
  /** Outcome */
  outcome: string;
  /** Profile used */
  profile: string;
  /** URLs visited (comma-separated) */
  urls: string;
  /** Action count */
  actionCount: number;
  /** Auto-submit count */
  autoSubmitCount: number;
  /** Approval required count */
  approvalRequiredCount: number;
  /** Duration formatted */
  duration: string;
  /** Error message if any */
  error?: string;
  /** Timestamp */
  timestamp: string;
}

/**
 * Logging configuration.
 */
export interface WebLoggingConfig {
  /** Log field values (default: false for privacy) */
  logFieldValues: boolean;
  /** Write to Notion WebOps Log */
  writeNotionWebOpsLog: boolean;
  /** Local log file path */
  localLogPath?: string;
  /** Notion WebOps Log database ID */
  notionWebOpsDbId?: string;
  /** Notion service instance (for actual API calls) */
  notionService?: NotionService;
}

// =============================================================================
// Log File Management
// =============================================================================

/**
 * Get the default log file path.
 */
export function getLogFilePath(): string {
  const openclawDir = join(homedir(), ".openclaw", "logs");
  const today = new Date().toISOString().split("T")[0];
  return join(openclawDir, `dj-web-${today}.jsonl`);
}

/**
 * Generate a unique log entry ID.
 */
export function generateLogId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `web-${timestamp}-${random}`;
}

// =============================================================================
// Web Operation Logger
// =============================================================================

/**
 * Logger for web operations.
 */
export class WebOperationLogger {
  private config: WebLoggingConfig;
  private currentLog: WebOperationLog | null = null;
  private actionSequence: number = 0;
  private notionService: NotionService | null = null;

  constructor(config: Partial<WebLoggingConfig> = {}) {
    this.config = {
      logFieldValues: config.logFieldValues ?? false,
      writeNotionWebOpsLog: config.writeNotionWebOpsLog ?? true,
      localLogPath: config.localLogPath,
      notionWebOpsDbId: config.notionWebOpsDbId,
      notionService: config.notionService,
    };
    this.notionService = config.notionService ?? null;
  }

  /**
   * Set the Notion service for API calls.
   * Can be set after construction if service is created lazily.
   */
  setNotionService(service: NotionService): void {
    this.notionService = service;
  }

  /**
   * Start logging a new web operation.
   */
  startOperation(workflowId: string, task: string, profile: "cheap" | "normal" | "deep"): string {
    const logId = generateLogId();
    this.currentLog = {
      id: logId,
      workflowId,
      timestamp: new Date().toISOString(),
      profile,
      task,
      outcome: "success", // Will be updated if it fails
      visitedUrls: [],
      actions: [],
      durationMs: 0,
    };
    this.actionSequence = 0;
    return logId;
  }

  /**
   * Log a navigation action.
   */
  logNavigation(url: string, durationMs?: number): void {
    if (!this.currentLog) return;

    this.actionSequence++;
    this.currentLog.actions.push({
      sequence: this.actionSequence,
      type: "navigate",
      url,
      actionClass: "READ_ONLY",
      durationMs,
    });

    if (!this.currentLog.visitedUrls.includes(url)) {
      this.currentLog.visitedUrls.push(url);
    }
  }

  /**
   * Log a click action.
   */
  logClick(
    url: string,
    elementText: string | undefined,
    decision: PolicyDecision,
    durationMs?: number,
  ): void {
    if (!this.currentLog) return;

    this.actionSequence++;
    this.currentLog.actions.push({
      sequence: this.actionSequence,
      type: "click",
      url,
      actionClass: decision.actionClass,
      approvalRequired: decision.requiresApproval,
      policyReason: decision.reason,
      elementText,
      durationMs,
    });
  }

  /**
   * Log a fill action (entering form data).
   */
  logFill(url: string, fieldNames: string[], fieldValues?: string[], durationMs?: number): void {
    if (!this.currentLog) return;

    this.actionSequence++;
    const action: WebActionLog = {
      sequence: this.actionSequence,
      type: "fill",
      url,
      actionClass: "READ_ONLY",
      fieldNames,
      durationMs,
    };

    // Only include field values if explicitly configured
    if (this.config.logFieldValues && fieldValues) {
      // Store in a way that's recoverable but not in the main type
      (action as unknown as Record<string, unknown>).fieldValues = fieldValues;
    }

    this.currentLog.actions.push(action);
  }

  /**
   * Log a submit action.
   */
  logSubmit(
    url: string,
    decision: PolicyDecision,
    autoSubmitted: boolean,
    approvalId?: string,
    durationMs?: number,
  ): void {
    if (!this.currentLog) return;

    this.actionSequence++;
    this.currentLog.actions.push({
      sequence: this.actionSequence,
      type: "submit",
      url,
      actionClass: decision.actionClass,
      autoSubmitted,
      approvalRequired: decision.requiresApproval,
      approvalId,
      denyResult: decision.denyResult,
      policyReason: decision.reason,
      durationMs,
    });
  }

  /**
   * Log a wait action.
   */
  logWait(url: string, reason: string, durationMs: number): void {
    if (!this.currentLog) return;

    this.actionSequence++;
    this.currentLog.actions.push({
      sequence: this.actionSequence,
      type: "wait",
      url,
      elementText: reason,
      durationMs,
    });
  }

  /**
   * Log a snapshot action.
   */
  logSnapshot(url: string, durationMs?: number): void {
    if (!this.currentLog) return;

    this.actionSequence++;
    this.currentLog.actions.push({
      sequence: this.actionSequence,
      type: "snapshot",
      url,
      durationMs,
    });
  }

  /**
   * Log an error on an action.
   */
  logActionError(error: string): void {
    if (!this.currentLog || this.currentLog.actions.length === 0) return;

    const lastAction = this.currentLog.actions[this.currentLog.actions.length - 1];
    lastAction.error = error;
  }

  /**
   * Set budget usage.
   */
  setBudgetUsage(toolCalls: number, tokens: number, costUsd: number): void {
    if (!this.currentLog) return;

    this.currentLog.budgetUsage = {
      toolCalls,
      tokens,
      costUsd,
    };
  }

  /**
   * End the operation with success.
   */
  async endSuccess(durationMs: number): Promise<void> {
    if (!this.currentLog) return;

    this.currentLog.outcome = "success";
    this.currentLog.durationMs = durationMs;
    await this.persist();
  }

  /**
   * End the operation with failure.
   */
  async endFailure(error: string, durationMs: number): Promise<void> {
    if (!this.currentLog) return;

    this.currentLog.outcome = "failure";
    this.currentLog.error = error;
    this.currentLog.durationMs = durationMs;
    await this.persist();
  }

  /**
   * End the operation paused (waiting for approval).
   */
  async endPaused(approvalId: string, durationMs: number): Promise<void> {
    if (!this.currentLog) return;

    this.currentLog.outcome = "paused";
    this.currentLog.durationMs = durationMs;
    await this.persist();
  }

  /**
   * End the operation cancelled.
   */
  async endCancelled(durationMs: number): Promise<void> {
    if (!this.currentLog) return;

    this.currentLog.outcome = "cancelled";
    this.currentLog.durationMs = durationMs;
    await this.persist();
  }

  /**
   * End the operation due to budget exceeded.
   */
  async endBudgetExceeded(durationMs: number): Promise<void> {
    if (!this.currentLog) return;

    this.currentLog.outcome = "budget_exceeded";
    this.currentLog.durationMs = durationMs;
    await this.persist();
  }

  /**
   * Get the current log (for inspection).
   */
  getCurrentLog(): WebOperationLog | null {
    return this.currentLog ? { ...this.currentLog } : null;
  }

  /**
   * Persist the log to file and optionally Notion.
   */
  private async persist(): Promise<void> {
    if (!this.currentLog) return;

    // Write to local file
    const logPath = this.config.localLogPath ?? getLogFilePath();
    const dir = dirname(logPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const logLine = JSON.stringify(this.currentLog) + "\n";
    appendFileSync(logPath, logLine, "utf-8");

    // Write to Notion if configured
    if (this.config.writeNotionWebOpsLog && this.config.notionWebOpsDbId) {
      await this.writeToNotion();
    }

    this.currentLog = null;
  }

  /**
   * Write to Notion WebOps Log.
   * Non-fatal: logs locally and continues if Notion write fails.
   */
  private async writeToNotion(): Promise<void> {
    if (!this.currentLog) return;

    // Skip if no Notion service available
    if (!this.notionService) {
      // Log warning only if user explicitly configured Notion but service is missing
      if (this.config.notionWebOpsDbId) {
        console.warn("[web-logging] Notion service not configured, skipping WebOps log write");
      }
      return;
    }

    // Extract unique domains from URLs for privacy (not full URLs)
    const domains = extractDomainsFromUrls(this.currentLog.visitedUrls);

    // Collect unique action classes
    const actionClasses = [
      ...new Set(
        this.currentLog.actions
          .map((a) => a.actionClass)
          .filter((c): c is ActionClass => c !== undefined),
      ),
    ];

    // Build WebOps log entry
    // IMPORTANT: Do NOT include field values for privacy
    const entry: WebOpsLogEntry = {
      workflowId: this.currentLog.workflowId,
      task: this.currentLog.task,
      startedAt: this.currentLog.timestamp,
      finishedAt: new Date().toISOString(),
      outcome: this.currentLog.outcome,
      domainsVisited: domains,
      actionClasses,
      approvedCount: this.currentLog.actions.filter((a) => a.approvalRequired).length,
      autoSubmitCount: this.currentLog.actions.filter((a) => a.autoSubmitted).length,
      profile: this.currentLog.profile,
      localLogPath: this.config.localLogPath ?? getLogFilePath(),
      error: this.currentLog.error,
    };

    try {
      const result = await this.notionService.createWebOpsLogEntry(entry);
      if (result) {
        console.log(`[web-logging] WebOps log written to Notion: ${result.id}`);
      }
    } catch (error) {
      // Non-fatal: log error locally and continue
      console.error("[web-logging] Failed to write WebOps log to Notion:", error);
    }
  }
}

/**
 * Extract unique domain names from URLs (for privacy - no full paths).
 */
function extractDomainsFromUrls(urls: string[]): string[] {
  const domains = new Set<string>();

  for (const url of urls) {
    try {
      const parsed = new URL(url);
      domains.add(parsed.hostname);
    } catch {
      // Skip invalid URLs
    }
  }

  return [...domains];
}

/**
 * Format duration in human-readable form.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Create a new web operation logger.
 */
export function createWebOperationLogger(config?: Partial<WebLoggingConfig>): WebOperationLogger {
  return new WebOperationLogger(config);
}
