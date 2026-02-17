/**
 * Plan Mode — enables agents to plan before executing.
 * Orchestrator agents review the plan before batch spawning sub-agents.
 */

export type PlanStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "executing"
  | "completed"
  | "failed";

export type PlanStep = {
  id: string;
  description: string;
  agentId?: string;
  dependencies: string[];
  estimatedComplexity: "trivial" | "moderate" | "complex";
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  result?: string;
  error?: string;
};

export type ExecutionPlan = {
  planId: string;
  sessionKey: string;
  createdAt: number;
  updatedAt: number;
  status: PlanStatus;
  task: string;
  steps: PlanStep[];
  phases: PlanStep[][]; // Steps grouped by parallel execution phase
  reviewerAgentId?: string;
  reviewNotes?: string;
  costEstimate?: { inputTokens: number; outputTokens: number };
};

const plans = new Map<string, ExecutionPlan>();

export function createPlan(params: {
  sessionKey: string;
  task: string;
  steps: Omit<PlanStep, "status" | "result" | "error">[];
}): ExecutionPlan {
  const planId = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const steps: PlanStep[] = params.steps.map((s) => ({
    ...s,
    status: "pending" as const,
  }));

  // Compute execution phases (topological sort by dependencies)
  const phases = computePhases(steps);

  const plan: ExecutionPlan = {
    planId,
    sessionKey: params.sessionKey,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "draft",
    task: params.task,
    steps,
    phases,
  };

  plans.set(planId, plan);
  return plan;
}

export function getPlan(planId: string): ExecutionPlan | undefined {
  return plans.get(planId);
}

export function submitPlanForReview(
  planId: string,
  reviewerAgentId?: string,
): ExecutionPlan | null {
  const plan = plans.get(planId);
  if (!plan) {
    return null;
  }
  plan.status = "pending_review";
  plan.reviewerAgentId = reviewerAgentId;
  plan.updatedAt = Date.now();
  return plan;
}

export function reviewPlan(
  planId: string,
  decision: "approve" | "reject",
  notes?: string,
): ExecutionPlan | null {
  const plan = plans.get(planId);
  if (!plan || plan.status !== "pending_review") {
    return null;
  }
  plan.status = decision === "approve" ? "approved" : "rejected";
  plan.reviewNotes = notes;
  plan.updatedAt = Date.now();
  return plan;
}

export function startPlanExecution(planId: string): ExecutionPlan | null {
  const plan = plans.get(planId);
  if (!plan || plan.status !== "approved") {
    return null;
  }
  plan.status = "executing";
  plan.updatedAt = Date.now();
  return plan;
}

export function updateStepStatus(
  planId: string,
  stepId: string,
  status: PlanStep["status"],
  result?: string,
  error?: string,
): ExecutionPlan | null {
  const plan = plans.get(planId);
  if (!plan) {
    return null;
  }
  const step = plan.steps.find((s) => s.id === stepId);
  if (!step) {
    return null;
  }
  step.status = status;
  if (result) {
    step.result = result;
  }
  if (error) {
    step.error = error;
  }
  plan.updatedAt = Date.now();

  // Check if failure should cascade
  if (status === "failed") {
    cascadeFailure(plan, stepId);
  }

  // Check if all steps complete
  const allDone = plan.steps.every(
    (s) => s.status === "completed" || s.status === "failed" || s.status === "skipped",
  );
  if (allDone) {
    const anyFailed = plan.steps.some((s) => s.status === "failed");
    plan.status = anyFailed ? "failed" : "completed";
  }

  return plan;
}

/** Cascade failure to steps that depend on the failed step. */
function cascadeFailure(plan: ExecutionPlan, failedStepId: string): void {
  for (const step of plan.steps) {
    if (step.dependencies.includes(failedStepId) && step.status === "pending") {
      step.status = "skipped";
      step.error = `Skipped: dependency "${failedStepId}" failed`;
      // Recursively cascade
      cascadeFailure(plan, step.id);
    }
  }
}

/** Get the next phase of steps ready to execute. */
export function getNextExecutablePhase(planId: string): PlanStep[] | null {
  const plan = plans.get(planId);
  if (!plan || plan.status !== "executing") {
    return null;
  }

  for (const phase of plan.phases) {
    const allPending = phase.every((s) => s.status === "pending");
    const depsReady = phase.every((s) =>
      s.dependencies.every((dep) => {
        const depStep = plan.steps.find((x) => x.id === dep);
        return depStep?.status === "completed";
      }),
    );
    if (allPending && depsReady) {
      return phase;
    }
  }
  return null;
}

export function listPlans(sessionKey?: string): ExecutionPlan[] {
  const all = [...plans.values()];
  if (sessionKey) {
    return all.filter((p) => p.sessionKey === sessionKey);
  }
  return all;
}

export function deletePlan(planId: string): boolean {
  return plans.delete(planId);
}

function computePhases(steps: PlanStep[]): PlanStep[][] {
  const phases: PlanStep[][] = [];
  const completed = new Set<string>();
  const remaining = new Set(steps.map((s) => s.id));

  while (remaining.size > 0) {
    const phase: PlanStep[] = [];
    for (const step of steps) {
      if (!remaining.has(step.id)) {
        continue;
      }
      const depsReady = step.dependencies.every((d) => completed.has(d));
      if (depsReady) {
        phase.push(step);
      }
    }
    if (phase.length === 0) {
      break;
    } // Cycle or invalid DAG
    for (const s of phase) {
      remaining.delete(s.id);
      completed.add(s.id);
    }
    phases.push(phase);
  }
  return phases;
}
