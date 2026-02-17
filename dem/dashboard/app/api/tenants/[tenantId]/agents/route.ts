import { NextResponse } from "next/server";
import { getGovernanceService } from "@/lib/governance";

type RouteParams = { params: Promise<{ tenantId: string }> };

/** GET /api/tenants/:id/agents — List all agents in a tenant. */
export async function GET(_request: Request, { params }: RouteParams) {
  const { tenantId } = await params;
  const { tenantService } = getGovernanceService();
  return NextResponse.json(tenantService.listAgents(tenantId));
}

/** POST /api/tenants/:id/agents — Add an agent to a tenant. */
export async function POST(request: Request, { params }: RouteParams) {
  const { tenantId } = await params;
  const body = await request.json();
  const { tenantService, policyService } = getGovernanceService();

  if (!body.name || !body.role) {
    return NextResponse.json({ error: "name and role are required" }, { status: 400 });
  }

  // Gate 0: validate model assignment against policy if a model ID is provided
  if (body.modelId) {
    const tenant = tenantService.get(tenantId);
    const check = policyService.validateModelAssignment(
      body.modelId,
      { level: "tenant", tenantId },
      { entityType: tenant?.entityType },
    );
    if (!check.allowed) {
      return NextResponse.json({ error: check.reason, gate: 0 }, { status: 403 });
    }
  }

  const agent = tenantService.addAgent(tenantId, {
    name: body.name,
    role: body.role,
    model: body.model,
    maturity: body.maturity,
    skills: body.skills,
    projectId: body.projectId,
  });

  if (!agent) {
    return NextResponse.json({ error: "Tenant or project not found" }, { status: 404 });
  }

  return NextResponse.json(agent, { status: 201 });
}
