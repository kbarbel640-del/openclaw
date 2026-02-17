/**
 * Server-side governance service singleton.
 *
 * In-memory for MVP. Production: backed by Postgres.
 * Shared across all API routes via module-level singleton.
 */

import { PolicyService } from "@six-fingered-man/governance/policies";
import { TenantService } from "@six-fingered-man/governance/tenants";

export interface GovernanceServices {
  tenantService: TenantService;
  policyService: PolicyService;
}

let instance: GovernanceServices | null = null;

export function getGovernanceService(): GovernanceServices {
  if (!instance) {
    instance = {
      tenantService: new TenantService({
        defaultModel: {
          provider: "ollama",
          model: "llama3.1:8b",
          server: "localhost",
        },
      }),
      policyService: new PolicyService(),
    };
  }
  return instance;
}
