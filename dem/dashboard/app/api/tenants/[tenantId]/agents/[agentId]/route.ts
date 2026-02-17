import { NextResponse } from "next/server";
import { getGovernanceService } from "@/lib/governance";

type RouteParams = { params: Promise<{ tenantId: string; agentId: string }> };

/** GET /api/tenants/:id/agents/:agentId — Get a single agent. */
export async function GET(_request: Request, { params }: RouteParams) {
  const { tenantId, agentId } = await params;
  const svc = getGovernanceService();
  const agent = svc.getAgent(tenantId, agentId);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json(agent);
}

/** DELETE /api/tenants/:id/agents/:agentId — Remove an agent. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { tenantId, agentId } = await params;
  const svc = getGovernanceService();

  if (!svc.removeAgent(tenantId, agentId)) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
