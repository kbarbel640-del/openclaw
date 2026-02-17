type MeshPlanStep = {
  id: string;
  name?: string;
  prompt: string;
  dependsOn?: string[];
  agentId?: string;
  sessionKey?: string;
  thinking?: string;
  timeoutMs?: number;
};

export type MeshWorkflowPlan = {
  planId: string;
  goal: string;
  createdAt: number;
  steps: MeshPlanStep[];
};

export type MeshPlanParams = {
  goal: string;
  steps?: Array<{
    id?: string;
    name?: string;
    prompt: string;
    dependsOn?: string[];
    agentId?: string;
    sessionKey?: string;
    thinking?: string;
    timeoutMs?: number;
  }>;
};

export type MeshRunParams = {
  plan: MeshWorkflowPlan;
  continueOnError?: boolean;
  maxParallel?: number;
  defaultStepTimeoutMs?: number;
  lane?: string;
};

export type MeshPlanAutoParams = {
  goal: string;
  maxSteps?: number;
  agentId?: string;
  sessionKey?: string;
  thinking?: string;
  timeoutMs?: number;
  lane?: string;
};

export type MeshStatusParams = {
  runId: string;
};

export type MeshRetryParams = {
  runId: string;
  stepIds?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalInt(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isPlanStep(value: unknown): value is MeshPlanStep {
  if (!isRecord(value)) {
    return false;
  }
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.prompt)) {
    return false;
  }
  if (!isOptionalString(value.name) || !isOptionalString(value.agentId)) {
    return false;
  }
  if (!isOptionalString(value.sessionKey) || !isOptionalString(value.thinking)) {
    return false;
  }
  if (!isOptionalInt(value.timeoutMs)) {
    return false;
  }
  if (value.dependsOn !== undefined && !isStringArray(value.dependsOn)) {
    return false;
  }
  return true;
}

export function validateMeshPlanParams(value: unknown): value is MeshPlanParams {
  if (!isRecord(value)) {
    return false;
  }
  if (!isNonEmptyString(value.goal)) {
    return false;
  }
  if (value.steps === undefined) {
    return true;
  }
  if (!Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > 128) {
    return false;
  }
  return value.steps.every((step) => {
    if (!isRecord(step) || !isNonEmptyString(step.prompt)) {
      return false;
    }
    if (!isOptionalString(step.id) || !isOptionalString(step.name)) {
      return false;
    }
    if (!isOptionalString(step.agentId) || !isOptionalString(step.sessionKey)) {
      return false;
    }
    if (!isOptionalString(step.thinking) || !isOptionalInt(step.timeoutMs)) {
      return false;
    }
    if (step.dependsOn !== undefined && !isStringArray(step.dependsOn)) {
      return false;
    }
    return true;
  });
}

export function validateMeshWorkflowPlan(value: unknown): value is MeshWorkflowPlan {
  if (!isRecord(value)) {
    return false;
  }
  if (!isNonEmptyString(value.planId) || !isNonEmptyString(value.goal)) {
    return false;
  }
  if (typeof value.createdAt !== "number" || !Number.isFinite(value.createdAt)) {
    return false;
  }
  if (!Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > 128) {
    return false;
  }
  return value.steps.every((step) => isPlanStep(step));
}

export function validateMeshRunParams(value: unknown): value is MeshRunParams {
  if (!isRecord(value) || !validateMeshWorkflowPlan(value.plan)) {
    return false;
  }
  if (value.continueOnError !== undefined && typeof value.continueOnError !== "boolean") {
    return false;
  }
  if (!isOptionalInt(value.maxParallel) || !isOptionalInt(value.defaultStepTimeoutMs)) {
    return false;
  }
  if (!isOptionalString(value.lane)) {
    return false;
  }
  return true;
}

export function validateMeshPlanAutoParams(value: unknown): value is MeshPlanAutoParams {
  if (!isRecord(value) || !isNonEmptyString(value.goal)) {
    return false;
  }
  if (!isOptionalInt(value.maxSteps) || !isOptionalInt(value.timeoutMs)) {
    return false;
  }
  if (!isOptionalString(value.agentId) || !isOptionalString(value.sessionKey)) {
    return false;
  }
  if (!isOptionalString(value.thinking) || !isOptionalString(value.lane)) {
    return false;
  }
  return true;
}

export function validateMeshStatusParams(value: unknown): value is MeshStatusParams {
  return isRecord(value) && isNonEmptyString(value.runId);
}

export function validateMeshRetryParams(value: unknown): value is MeshRetryParams {
  if (!isRecord(value) || !isNonEmptyString(value.runId)) {
    return false;
  }
  if (value.stepIds === undefined) {
    return true;
  }
  return isStringArray(value.stepIds) && value.stepIds.length > 0;
}
