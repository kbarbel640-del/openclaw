import type { PolicyCheckParams } from "@six-fingered-man/governance";
import { NextResponse } from "next/server";
import { getGovernanceService } from "@/lib/governance";

/** POST /api/policies/check — Gate 0 policy check. */
export async function POST(request: Request) {
  const body = (await request.json()) as PolicyCheckParams;
  const { policyService } = getGovernanceService();

  if (!body.resourceType || !body.resourceId || !body.scope) {
    return NextResponse.json(
      { error: "resourceType, resourceId, and scope are required" },
      { status: 400 },
    );
  }

  const result = policyService.check(body);
  return NextResponse.json(result);
}
