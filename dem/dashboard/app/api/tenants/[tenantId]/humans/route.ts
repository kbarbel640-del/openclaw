import { NextResponse } from "next/server";
import { getGovernanceService } from "@/lib/governance";

type RouteParams = { params: Promise<{ tenantId: string }> };

/** GET /api/tenants/:id/humans — List humans. */
export async function GET(_request: Request, { params }: RouteParams) {
  const { tenantId } = await params;
  const { tenantService } = getGovernanceService();
  return NextResponse.json(tenantService.listHumans(tenantId));
}

/** POST /api/tenants/:id/humans — Add a human. */
export async function POST(request: Request, { params }: RouteParams) {
  const { tenantId } = await params;
  const body = await request.json();
  const { tenantService } = getGovernanceService();

  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const human = tenantService.addHuman(tenantId, {
    name: body.name,
    contact: body.contact,
  });

  if (!human) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json(human, { status: 201 });
}
