/**
 * Web Operator for DJ
 *
 * Orchestrates browser automation with plan/do/approve workflow,
 * BudgetGovernor integration, and policy enforcement.
 */

import { randomUUID } from "node:crypto";
import type { BudgetGovernor } from "../budget/governor.js";
import type { BudgetProfileId } from "../budget/types.js";
import {
  type AutoSubmitCheckResult,
  AutoSubmitStateManager,
  createAutoSubmitStateManager,
} from "./web-autosubmit-state.js";
import {
  type WebLoggingConfig,
  WebOperationLogger,
  createWebOperationLogger,
} from "./web-logging.js";
import {
  type ActionClass,
  type AllowlistEntry,
  type PageContext,
  type PolicyDecision,
  type WebPolicyConfig,
  AllowlistManager,
  DEFAULT_POLICY_CONFIG,
  evaluatePolicy,
  HARD_APPROVAL_ACTIONS,
} from "./web-policy.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Web operator configuration.
 */
export interface WebOperatorConfig {
  policy: WebPolicyConfig;
  logging: Partial<WebLoggingConfig>;
  /** Approval timeout in milliseconds (default: 5 minutes) */
  approvalTimeoutMs: number;
  /** Custom allowlist entries */
  customAllowlist?: AllowlistEntry[];
}

/**
 * Workflow state.
 */
export type WorkflowStatus =
  | "planning"
  | "executing"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "budget_exceeded";

/**
 * Pending approval.
 */
export interface PendingApproval {
  id: string;
  workflowId: string;
  actionType: "navigate" | "click" | "fill" | "submit";
  actionClass: ActionClass;
  url: string;
  reason: string;
  context: PageContext;
  buttonText?: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Workflow step (planned action).
 */
export interface WorkflowStep {
  id: string;
  type: "navigate" | "click" | "fill" | "submit" | "wait" | "snapshot";
  url?: string;
  selector?: string;
  value?: string;
  fieldName?: string;
  buttonText?: string;
  waitMs?: number;
  description: string;
}

/**
 * Workflow execution result.
 */
export interface WorkflowResult {
  workflowId: string;
  status: WorkflowStatus;
  stepsCompleted: number;
  totalSteps: number;
  pendingApproval?: PendingApproval;
  error?: string;
  output?: string;
}

/**
 * Browser interface (to be injected).
 */
export interface BrowserInterface {
  navigate(url: string): Promise<void>;
  click(selector: string): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  submit(selector?: string): Promise<void>;
  snapshot(): Promise<PageContext>;
  wait(ms: number): Promise<void>;
  close(): Promise<void>;
}

// =============================================================================
// Default Configuration
// =============================================================================

export const DEFAULT_OPERATOR_CONFIG: WebOperatorConfig = {
  policy: DEFAULT_POLICY_CONFIG,
  logging: {},
  approvalTimeoutMs: 5 * 60 * 1000, // 5 minutes
};

// =============================================================================
// Web Operator
// =============================================================================

/**
 * Web Operator - orchestrates browser automation with safety controls.
 */
export class WebOperator {
  private config: WebOperatorConfig;
  private allowlistManager: AllowlistManager;
  private autoSubmitState: AutoSubmitStateManager;
  private logger: WebOperationLogger;
  private pendingApprovals: Map<string, PendingApproval> = new Map();
  private activeWorkflows: Map<string, { steps: WorkflowStep[]; currentStep: number }> = new Map();

  constructor(config: Partial<WebOperatorConfig> = {}) {
    this.config = {
      ...DEFAULT_OPERATOR_CONFIG,
      ...config,
      policy: { ...DEFAULT_POLICY_CONFIG, ...config.policy },
      logging: { ...config.logging },
    };

    this.allowlistManager = new AllowlistManager(config.customAllowlist);
    this.autoSubmitState = createAutoSubmitStateManager({
      dailyCap: this.config.policy.autoSubmitDailyCap,
      workflowCap: this.config.policy.autoSubmitWorkflowCap,
    });
    this.logger = createWebOperationLogger(this.config.logging);
  }

  // ===========================================================================
  // Profile Checks
  // ===========================================================================

  /**
   * Check if browser is allowed for the given budget profile.
   */
  isBrowserAllowedForProfile(profile: BudgetProfileId): boolean {
    // Browser is disabled in cheap profile
    return profile !== "cheap";
  }

  /**
   * Get profile restriction message.
   */
  getProfileRestrictionMessage(profile: BudgetProfileId): string | null {
    if (profile === "cheap") {
      return "Browser automation is disabled in 'cheap' profile. Switch to 'normal' or 'deep' profile with `/budget normal` or `/budget deep`.";
    }
    return null;
  }

  // ===========================================================================
  // Allowlist Management
  // ===========================================================================

  /**
   * List all allowlist entries.
   */
  listAllowlist(): AllowlistEntry[] {
    return this.allowlistManager.list();
  }

  /**
   * Add an allowlist entry.
   */
  addAllowlistEntry(entry: AllowlistEntry): void {
    this.allowlistManager.add(entry);
  }

  /**
   * Remove an allowlist entry.
   */
  removeAllowlistEntry(host: string): boolean {
    return this.allowlistManager.remove(host);
  }

  // ===========================================================================
  // Auto-Submit Control
  // ===========================================================================

  /**
   * Check if auto-submit is enabled.
   */
  isAutoSubmitEnabled(): boolean {
    return this.config.policy.autoSubmitEnabled;
  }

  /**
   * Enable auto-submit.
   */
  enableAutoSubmit(): void {
    this.config.policy.autoSubmitEnabled = true;
  }

  /**
   * Disable auto-submit.
   */
  disableAutoSubmit(): void {
    this.config.policy.autoSubmitEnabled = false;
  }

  /**
   * Get auto-submit state.
   */
  getAutoSubmitState(): {
    enabled: boolean;
    dailyCount: number;
    dailyCap: number;
  } {
    return {
      enabled: this.config.policy.autoSubmitEnabled,
      dailyCount: this.autoSubmitState.getDailyCount(),
      dailyCap: this.config.policy.autoSubmitDailyCap,
    };
  }

  // ===========================================================================
  // Plan Mode
  // ===========================================================================

  /**
   * Plan a web operation (dry-run, no side effects).
   *
   * IMPORTANT: This method MUST NOT cause any browser side effects.
   * It only analyzes the task and produces a plan.
   */
  async plan(
    task: string,
    profile: BudgetProfileId,
    _governor?: BudgetGovernor,
  ): Promise<{
    workflowId: string;
    steps: WorkflowStep[];
    warnings: string[];
    blockers: string[];
  }> {
    const workflowId = generateWorkflowId();
    const warnings: string[] = [];
    const blockers: string[] = [];

    // Check profile restrictions
    const profileRestriction = this.getProfileRestrictionMessage(profile);
    if (profileRestriction) {
      blockers.push(profileRestriction);
    }

    // Parse task into steps (simplified - real implementation would use LLM)
    const steps = this.parseTaskToSteps(task, workflowId);

    // Analyze steps for warnings
    for (const step of steps) {
      if (step.type === "submit") {
        const autoSubmitCheck = this.autoSubmitState.checkAutoSubmit(workflowId);
        if (!autoSubmitCheck.allowed) {
          warnings.push(`Auto-submit may be blocked: ${autoSubmitCheck.reason}`);
        }
      }
    }

    return {
      workflowId,
      steps,
      warnings,
      blockers,
    };
  }

  /**
   * Parse a task description into workflow steps.
   * This is a simplified implementation - real implementation would use LLM.
   */
  private parseTaskToSteps(task: string, _workflowId: string): WorkflowStep[] {
    const steps: WorkflowStep[] = [];
    const lowerTask = task.toLowerCase();

    // Simple pattern matching for common tasks
    // Real implementation would use LLM to parse complex tasks

    // Check for URL navigation
    const urlMatch = task.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      steps.push({
        id: randomUUID(),
        type: "navigate",
        url: urlMatch[0],
        description: `Navigate to ${urlMatch[0]}`,
      });
    }

    // Check for form filling patterns
    if (lowerTask.includes("fill") || lowerTask.includes("enter")) {
      steps.push({
        id: randomUUID(),
        type: "fill",
        description: "Fill form fields",
      });
    }

    // Check for submit patterns
    if (
      lowerTask.includes("submit") ||
      lowerTask.includes("send") ||
      lowerTask.includes("subscribe")
    ) {
      steps.push({
        id: randomUUID(),
        type: "submit",
        description: "Submit form",
      });
    }

    // Check for click patterns
    if (lowerTask.includes("click")) {
      steps.push({
        id: randomUUID(),
        type: "click",
        description: "Click element",
      });
    }

    // Always add a snapshot at the end
    steps.push({
      id: randomUUID(),
      type: "snapshot",
      description: "Take final snapshot",
    });

    return steps;
  }

  // ===========================================================================
  // Do Mode (Execution)
  // ===========================================================================

  /**
   * Execute a web operation.
   */
  async execute(
    task: string,
    profile: BudgetProfileId,
    browser: BrowserInterface,
    governor?: BudgetGovernor,
  ): Promise<WorkflowResult> {
    const startTime = Date.now();

    // Check profile restrictions
    if (!this.isBrowserAllowedForProfile(profile)) {
      const message = this.getProfileRestrictionMessage(profile)!;
      return {
        workflowId: "",
        status: "failed",
        stepsCompleted: 0,
        totalSteps: 0,
        error: message,
      };
    }

    // Plan first
    const plan = await this.plan(task, profile, governor);

    if (plan.blockers.length > 0) {
      return {
        workflowId: plan.workflowId,
        status: "failed",
        stepsCompleted: 0,
        totalSteps: plan.steps.length,
        error: plan.blockers.join("; "),
      };
    }

    // Start logging
    this.logger.startOperation(plan.workflowId, task, profile);

    // Start workflow
    this.autoSubmitState.startWorkflow(plan.workflowId);
    this.activeWorkflows.set(plan.workflowId, {
      steps: plan.steps,
      currentStep: 0,
    });

    try {
      // Execute steps
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];

        // Check budget
        if (governor) {
          const budgetCheck = governor.recordToolCall("browser");
          if (!budgetCheck.allowed) {
            await this.logger.endBudgetExceeded(Date.now() - startTime);
            return {
              workflowId: plan.workflowId,
              status: "budget_exceeded",
              stepsCompleted: i,
              totalSteps: plan.steps.length,
              error: `Budget exceeded: ${budgetCheck.exceededLimit}`,
            };
          }
        }

        const result = await this.executeStep(step, plan.workflowId, browser, profile);

        if (result.paused) {
          await this.logger.endPaused(result.approvalId!, Date.now() - startTime);
          return {
            workflowId: plan.workflowId,
            status: "paused",
            stepsCompleted: i,
            totalSteps: plan.steps.length,
            pendingApproval: this.pendingApprovals.get(result.approvalId!),
          };
        }

        if (result.error) {
          await this.logger.endFailure(result.error, Date.now() - startTime);
          return {
            workflowId: plan.workflowId,
            status: "failed",
            stepsCompleted: i,
            totalSteps: plan.steps.length,
            error: result.error,
          };
        }

        this.activeWorkflows.get(plan.workflowId)!.currentStep = i + 1;
      }

      // Success
      await this.logger.endSuccess(Date.now() - startTime);
      this.autoSubmitState.endWorkflow(plan.workflowId);
      this.activeWorkflows.delete(plan.workflowId);

      return {
        workflowId: plan.workflowId,
        status: "completed",
        stepsCompleted: plan.steps.length,
        totalSteps: plan.steps.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logger.endFailure(errorMessage, Date.now() - startTime);

      return {
        workflowId: plan.workflowId,
        status: "failed",
        stepsCompleted: 0,
        totalSteps: plan.steps.length,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute a single step.
   */
  private async executeStep(
    step: WorkflowStep,
    workflowId: string,
    browser: BrowserInterface,
    _profile: BudgetProfileId,
  ): Promise<{ paused?: boolean; approvalId?: string; error?: string }> {
    const startTime = Date.now();

    try {
      switch (step.type) {
        case "navigate": {
          if (!step.url) {
            return { error: "Navigate step missing URL" };
          }
          await browser.navigate(step.url);
          this.logger.logNavigation(step.url, Date.now() - startTime);
          break;
        }

        case "click": {
          if (!step.selector) {
            return { error: "Click step missing selector" };
          }

          const context = await browser.snapshot();
          const decision = evaluatePolicy(
            "click",
            context,
            this.config.policy,
            this.allowlistManager.list(),
            step.buttonText,
          );

          this.logger.logClick(context.url, step.buttonText, decision, Date.now() - startTime);

          if (decision.requiresApproval) {
            const approval = this.createPendingApproval(
              workflowId,
              "click",
              decision.actionClass,
              context,
              decision.reason,
              step.buttonText,
            );
            return { paused: true, approvalId: approval.id };
          }

          await browser.click(step.selector);
          break;
        }

        case "fill": {
          if (!step.selector || !step.value) {
            return { error: "Fill step missing selector or value" };
          }

          const context = await browser.snapshot();
          this.logger.logFill(
            context.url,
            [step.fieldName || step.selector],
            this.config.logging.logFieldValues ? [step.value] : undefined,
            Date.now() - startTime,
          );

          await browser.fill(step.selector, step.value);
          break;
        }

        case "submit": {
          const context = await browser.snapshot();
          const decision = evaluatePolicy(
            "submit",
            context,
            this.config.policy,
            this.allowlistManager.list(),
            step.buttonText,
          );

          // Check auto-submit caps
          let autoSubmitted = false;
          if (!decision.requiresApproval) {
            const autoSubmitCheck = this.autoSubmitState.checkAutoSubmit(workflowId);
            if (!autoSubmitCheck.allowed) {
              // Cap exceeded, require approval
              const approval = this.createPendingApproval(
                workflowId,
                "submit",
                decision.actionClass,
                context,
                autoSubmitCheck.reason || "Auto-submit cap exceeded",
                step.buttonText,
              );
              this.logger.logSubmit(
                context.url,
                decision,
                false,
                approval.id,
                Date.now() - startTime,
              );
              return { paused: true, approvalId: approval.id };
            }

            // Record the auto-submit
            this.autoSubmitState.recordAutoSubmit(workflowId, context.url);
            autoSubmitted = true;
          }

          this.logger.logSubmit(
            context.url,
            decision,
            autoSubmitted,
            undefined,
            Date.now() - startTime,
          );

          if (decision.requiresApproval) {
            const approval = this.createPendingApproval(
              workflowId,
              "submit",
              decision.actionClass,
              context,
              decision.reason,
              step.buttonText,
            );
            return { paused: true, approvalId: approval.id };
          }

          await browser.submit(step.selector);
          break;
        }

        case "wait": {
          const waitMs = step.waitMs || 1000;
          const context = await browser.snapshot();
          this.logger.logWait(context.url, step.description, waitMs);
          await browser.wait(waitMs);
          break;
        }

        case "snapshot": {
          const context = await browser.snapshot();
          this.logger.logSnapshot(context.url, Date.now() - startTime);
          break;
        }

        default:
          return { error: `Unknown step type: ${step.type}` };
      }

      return {};
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.logActionError(errorMessage);
      return { error: errorMessage };
    }
  }

  // ===========================================================================
  // Approval Management
  // ===========================================================================

  /**
   * Create a pending approval.
   */
  private createPendingApproval(
    workflowId: string,
    actionType: "navigate" | "click" | "fill" | "submit",
    actionClass: ActionClass,
    context: PageContext,
    reason: string,
    buttonText?: string,
  ): PendingApproval {
    const now = new Date();
    const approval: PendingApproval = {
      id: randomUUID(),
      workflowId,
      actionType,
      actionClass,
      url: context.url,
      reason,
      context,
      buttonText,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.approvalTimeoutMs),
    };

    this.pendingApprovals.set(approval.id, approval);
    return approval;
  }

  /**
   * Get a pending approval.
   */
  getPendingApproval(approvalId: string): PendingApproval | null {
    const approval = this.pendingApprovals.get(approvalId);
    if (!approval) {
      return null;
    }

    // Check expiration
    if (new Date() > approval.expiresAt) {
      this.pendingApprovals.delete(approvalId);
      return null;
    }

    return approval;
  }

  /**
   * List all pending approvals.
   */
  listPendingApprovals(): PendingApproval[] {
    const now = new Date();
    const valid: PendingApproval[] = [];

    for (const [id, approval] of this.pendingApprovals) {
      if (now > approval.expiresAt) {
        this.pendingApprovals.delete(id);
      } else {
        valid.push(approval);
      }
    }

    return valid;
  }

  /**
   * Approve a pending action and resume workflow.
   */
  async approve(
    approvalId: string,
    browser: BrowserInterface,
    profile: BudgetProfileId,
    governor?: BudgetGovernor,
  ): Promise<WorkflowResult> {
    const approval = this.getPendingApproval(approvalId);
    if (!approval) {
      return {
        workflowId: "",
        status: "failed",
        stepsCompleted: 0,
        totalSteps: 0,
        error: "Approval not found or expired",
      };
    }

    // Remove from pending
    this.pendingApprovals.delete(approvalId);

    // Get workflow state
    const workflow = this.activeWorkflows.get(approval.workflowId);
    if (!workflow) {
      return {
        workflowId: approval.workflowId,
        status: "failed",
        stepsCompleted: 0,
        totalSteps: 0,
        error: "Workflow not found",
      };
    }

    // Execute the approved action
    const step = workflow.steps[workflow.currentStep];
    const startTime = Date.now();

    try {
      switch (approval.actionType) {
        case "click":
          if (step.selector) {
            await browser.click(step.selector);
          }
          break;
        case "submit":
          await browser.submit(step.selector);
          break;
        default:
          // Other actions don't need special handling after approval
          break;
      }

      workflow.currentStep++;

      // Continue execution
      const remainingSteps = workflow.steps.slice(workflow.currentStep);
      for (const remainingStep of remainingSteps) {
        if (governor) {
          const budgetCheck = governor.recordToolCall("browser");
          if (!budgetCheck.allowed) {
            return {
              workflowId: approval.workflowId,
              status: "budget_exceeded",
              stepsCompleted: workflow.currentStep,
              totalSteps: workflow.steps.length,
              error: `Budget exceeded: ${budgetCheck.exceededLimit}`,
            };
          }
        }

        const result = await this.executeStep(remainingStep, approval.workflowId, browser, profile);

        if (result.paused) {
          return {
            workflowId: approval.workflowId,
            status: "paused",
            stepsCompleted: workflow.currentStep,
            totalSteps: workflow.steps.length,
            pendingApproval: this.pendingApprovals.get(result.approvalId!),
          };
        }

        if (result.error) {
          return {
            workflowId: approval.workflowId,
            status: "failed",
            stepsCompleted: workflow.currentStep,
            totalSteps: workflow.steps.length,
            error: result.error,
          };
        }

        workflow.currentStep++;
      }

      // Completed
      this.autoSubmitState.endWorkflow(approval.workflowId);
      this.activeWorkflows.delete(approval.workflowId);

      return {
        workflowId: approval.workflowId,
        status: "completed",
        stepsCompleted: workflow.steps.length,
        totalSteps: workflow.steps.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        workflowId: approval.workflowId,
        status: "failed",
        stepsCompleted: workflow.currentStep,
        totalSteps: workflow.steps.length,
        error: errorMessage,
      };
    }
  }

  /**
   * Reject a pending approval.
   */
  reject(approvalId: string): boolean {
    const approval = this.getPendingApproval(approvalId);
    if (!approval) {
      return false;
    }

    this.pendingApprovals.delete(approvalId);
    this.autoSubmitState.endWorkflow(approval.workflowId);
    this.activeWorkflows.delete(approval.workflowId);

    return true;
  }

  // ===========================================================================
  // Cron Safety
  // ===========================================================================

  /**
   * Get safe profile for cron execution.
   * Cron tasks must NEVER inherit deep mode.
   */
  getSafeProfileForCron(requestedProfile: BudgetProfileId): BudgetProfileId {
    if (requestedProfile === "deep") {
      return "normal";
    }
    return requestedProfile;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Generate a unique workflow ID.
 */
export function generateWorkflowId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `wf-${timestamp}-${random}`;
}

/**
 * Create a new web operator.
 */
export function createWebOperator(config?: Partial<WebOperatorConfig>): WebOperator {
  return new WebOperator(config);
}

/**
 * Check if an action class always requires approval.
 */
export function requiresHardApproval(actionClass: ActionClass): boolean {
  return HARD_APPROVAL_ACTIONS.includes(actionClass);
}
