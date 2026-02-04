/**
 * Budget Governance Module
 *
 * Enforces resource limits on agent workflows:
 * - Tool call limits
 * - LLM call limits
 * - Token/cost limits
 * - Runtime limits
 * - Retry loop detection
 */

// Types
export type {
  BudgetCheckResult,
  BudgetConfig,
  BudgetEvent,
  BudgetGovernorOptions,
  BudgetLimits,
  BudgetProfile,
  BudgetProfileId,
  BudgetStatus,
  BudgetUsage,
  DeepArmOptions,
} from "./types.js";

// Constants
export { DEEP_MODE_DEFAULT_EXPIRY_MS } from "./types.js";

// Profiles
export {
  BUDGET_PROFILES,
  CHEAP_LIMITS,
  DEEP_LIMITS,
  getBudgetProfile,
  getDefaultProfileId,
  getProfileLimits,
  isValidProfileId,
  listProfileIds,
  NORMAL_LIMITS,
} from "./profiles.js";

// Governor
export {
  BudgetGovernor,
  createBudgetGovernor,
  createCheapGovernor,
  createDeepGovernor,
  createNormalGovernor,
} from "./governor.js";

// Config
export {
  buildGovernorOptionsFromConfig,
  resolveAgentBudgetProfile,
  resolveBudgetConfig,
  resolveEffectiveLimits,
} from "./config.js";
