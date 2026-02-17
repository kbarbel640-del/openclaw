import { NextResponse } from "next/server";
import { getGovernanceService } from "@/lib/governance";

type RouteParams = { params: Promise<{ tenantId: string }> };

/** GET /api/tenants/:id/projects — List projects. */
export async function GET(_request: Request, { params }: RouteParams) {
  const { tenantId } = await params;
  const svc = getGovernanceService();
  return NextResponse.json(svc.listProjects(tenantId));
}

/** POST /api/tenants/:id/projects — Create a project. */
export async function POST(request: Request, { params }: RouteParams) {
  const { tenantId } = await params;
  const body = await request.json();
  const svc = getGovernanceService();

  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const project = svc.createProject(tenantId, {
    name: body.name,
    description: body.description,
  });

  if (!project) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json(project, { status: 201 });
}
