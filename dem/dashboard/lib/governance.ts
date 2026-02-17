/**
 * Server-side governance service singleton.
 *
 * In-memory for MVP. Production: backed by Postgres.
 * Shared across all API routes via module-level singleton.
 */

import { TenantService } from "@six-fingered-man/governance/tenants";

let instance: TenantService | null = null;

export function getGovernanceService(): TenantService {
  if (!instance) {
    instance = new TenantService({
      defaultModel: {
        provider: "ollama",
        model: "llama3.1:8b",
        server: "localhost",
      },
    });
  }
  return instance;
}
