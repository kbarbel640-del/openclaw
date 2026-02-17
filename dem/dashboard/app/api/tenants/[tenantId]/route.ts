import { NextResponse } from "next/server";
import { getGovernanceService } from "@/lib/governance";

type RouteParams = { params: Promise<{ tenantId: string }> };

/** GET /api/tenants/:id — Get a single tenant. */
export async function GET(_request: Request, { params }: RouteParams) {
  const { tenantId } = await params;
  const { tenantService } = getGovernanceService();
  const tenant = tenantService.get(tenantId);

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json(tenant);
}

/** PATCH /api/tenants/:id — Update tenant metadata. */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { tenantId } = await params;
  const body = await request.json();
  const { tenantService } = getGovernanceService();

  const updated = tenantService.update(tenantId, body);
  if (!updated) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

/** DELETE /api/tenants/:id — Delete a tenant. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { tenantId } = await params;
  const { tenantService } = getGovernanceService();

  if (!tenantService.delete(tenantId)) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
