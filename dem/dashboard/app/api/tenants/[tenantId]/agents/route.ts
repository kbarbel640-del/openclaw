import { NextResponse } from "next/server";
import { getGovernanceService } from "@/lib/governance";

type RouteParams = { params: Promise<{ tenantId: string }> };

/** GET /api/tenants/:id/agents — List all agents in a tenant. */
export async function GET(_request: Request, { params }: RouteParams) {
  const { tenantId } = await params;
  const svc = getGovernanceService();
  return NextResponse.json(svc.listAgents(tenantId));
}

/** POST /api/tenants/:id/agents — Add an agent to a tenant. */
export async function POST(request: Request, { params }: RouteParams) {
  const { tenantId } = await params;
  const body = await request.json();
  const svc = getGovernanceService();

  if (!body.name || !body.role) {
    return NextResponse.json({ error: "name and role are required" }, { status: 400 });
  }

  const agent = svc.addAgent(tenantId, {
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
