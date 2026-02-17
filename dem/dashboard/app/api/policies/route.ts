import type { DID } from "@six-fingered-man/governance";
import { NextResponse } from "next/server";
import { getGovernanceService } from "@/lib/governance";

/** GET /api/policies — List all policies. */
export async function GET() {
  const { policyService } = getGovernanceService();
  return NextResponse.json(policyService.listPolicies());
}

/** POST /api/policies — Set the global policy. */
export async function POST(request: Request) {
  const body = await request.json();
  const { policyService } = getGovernanceService();

  if (!body.catalogs || !body.constraints || !body.updatedBy) {
    return NextResponse.json(
      { error: "catalogs, constraints, and updatedBy are required" },
      { status: 400 },
    );
  }

  const doc = policyService.setGlobalPolicy({
    catalogs: body.catalogs,
    constraints: body.constraints,
    updatedBy: body.updatedBy as DID,
  });

  return NextResponse.json(doc, { status: 201 });
}
