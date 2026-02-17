import type { PolicyScope, PolicyScopeLevel } from "@six-fingered-man/governance";
import { NextResponse } from "next/server";
import { getGovernanceService } from "@/lib/governance";

/** GET /api/policies/catalog/tools?scope=tenant&tenantId=t-1 — Filtered tools. */
export async function GET(request: Request) {
  const { policyService } = getGovernanceService();
  const { searchParams } = new URL(request.url);

  const scope: PolicyScope = {
    level: (searchParams.get("scope") ?? "global") as PolicyScopeLevel,
    entityType: searchParams.get("entityType") as PolicyScope["entityType"],
    tenantId: searchParams.get("tenantId") ?? undefined,
    agentId: searchParams.get("agentId") ?? undefined,
  };

  const tools = policyService.getAvailableTools(scope);
  return NextResponse.json(tools);
}
