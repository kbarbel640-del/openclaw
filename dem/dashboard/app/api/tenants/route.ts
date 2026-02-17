import { NextResponse } from "next/server";
import { getGovernanceService } from "@/lib/governance";

/** GET /api/tenants — List all tenants. */
export async function GET() {
  const { tenantService } = getGovernanceService();
  return NextResponse.json(tenantService.list());
}

/** POST /api/tenants — Create a new tenant. */
export async function POST(request: Request) {
  const body = await request.json();
  const { tenantService } = getGovernanceService();

  if (!body.name || !body.entityType) {
    return NextResponse.json({ error: "name and entityType are required" }, { status: 400 });
  }

  const tenant = tenantService.create({
    name: body.name,
    entityType: body.entityType,
    entityConfig: body.entityConfig,
    overrides: body.overrides,
  });

  return NextResponse.json(tenant, { status: 201 });
}
