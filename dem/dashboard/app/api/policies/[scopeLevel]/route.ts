import type { DID, PolicyScope, PolicyScopeLevel } from "@six-fingered-man/governance";
import { NextResponse } from "next/server";
import { getGovernanceService } from "@/lib/governance";

type RouteParams = { params: Promise<{ scopeLevel: string }> };

const VALID_SCOPE_LEVELS = new Set(["entity-type", "tenant", "agent"]);

function parseScopeFromRequest(
  scopeLevel: string,
  searchParams: URLSearchParams,
): PolicyScope | null {
  if (!VALID_SCOPE_LEVELS.has(scopeLevel)) {
    return null;
  }

  const level = scopeLevel as PolicyScopeLevel;
  switch (level) {
    case "entity-type":
      return { level, entityType: searchParams.get("entityType") as PolicyScope["entityType"] };
    case "tenant":
      return { level, tenantId: searchParams.get("tenantId") ?? undefined };
    case "agent":
      return { level, agentId: searchParams.get("agentId") ?? undefined };
    default:
      return null;
  }
}

/** PUT /api/policies/:scopeLevel — Set a scoped policy. */
export async function PUT(request: Request, { params }: RouteParams) {
  const { scopeLevel } = await params;
  const body = await request.json();
  const { policyService } = getGovernanceService();

  const url = new URL(request.url);
  const scope = parseScopeFromRequest(scopeLevel, url.searchParams);
  if (!scope) {
    return NextResponse.json({ error: `Invalid scope level: ${scopeLevel}` }, { status: 400 });
  }

  if (!body.catalogs || !body.constraints || !body.updatedBy) {
    return NextResponse.json(
      { error: "catalogs, constraints, and updatedBy are required" },
      { status: 400 },
    );
  }

  const doc = policyService.setPolicy({
    scope,
    catalogs: body.catalogs,
    constraints: body.constraints,
    updatedBy: body.updatedBy as DID,
  });

  return NextResponse.json(doc);
}

/** DELETE /api/policies/:scopeLevel — Delete a scoped policy. */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { scopeLevel } = await params;
  const { policyService } = getGovernanceService();

  const url = new URL(request.url);
  const scope = parseScopeFromRequest(scopeLevel, url.searchParams);
  if (!scope) {
    return NextResponse.json({ error: `Invalid scope level: ${scopeLevel}` }, { status: 400 });
  }

  const deletedBy = url.searchParams.get("deletedBy") as DID | null;
  if (!deletedBy) {
    return NextResponse.json({ error: "deletedBy query parameter is required" }, { status: 400 });
  }

  if (!policyService.deletePolicy(scope, deletedBy)) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
