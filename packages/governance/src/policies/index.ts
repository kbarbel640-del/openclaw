/**
 * Policy module — public API.
 *
 * MSP governance floor + customer authoring separation.
 *
 * @example
 * ```ts
 * import { PolicyService } from "@six-fingered-man/governance/policies";
 * import { generateDID } from "@six-fingered-man/governance/identity";
 *
 * const service = new PolicyService();
 * const admin = generateDID();
 *
 * // Set a global policy using built-in defaults
 * import { DEFAULT_CATALOGS, DEFAULT_CONSTRAINTS } from "@six-fingered-man/governance/policies";
 *
 * service.setGlobalPolicy({
 *   catalogs: DEFAULT_CATALOGS,
 *   constraints: DEFAULT_CONSTRAINTS,
 *   updatedBy: admin.did,
 * });
 *
 * // Gate 0 check
 * const result = service.check({
 *   resourceType: "model",
 *   resourceId: "llama3.1-8b",
 *   scope: { level: "tenant", tenantId: "t-123" },
 * });
 * // result.allowed === true
 * ```
 */

export { PolicyService } from "./service.js";
export type { PolicyServiceConfig } from "./service.js";

export {
  DEFAULT_MODELS,
  DEFAULT_TOOLS,
  DEFAULT_SECRETS,
  DEFAULT_SKILLS,
  DEFAULT_CODE_POLICY,
  DEFAULT_CONSTRAINTS,
  DEFAULT_CATALOGS,
} from "./catalogs.js";
