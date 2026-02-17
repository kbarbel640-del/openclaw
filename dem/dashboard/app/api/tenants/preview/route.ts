import { listEntityTypes, ENTITY_TYPE_LABELS } from "@six-fingered-man/governance/tenants";
import { NextResponse } from "next/server";
import { getGovernanceService } from "@/lib/governance";

/** GET /api/tenants/preview?entityType=llc — Preview a template. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");

  if (!entityType) {
    // Return available entity types
    const types = listEntityTypes().map((t) => ({
      value: t,
      label: ENTITY_TYPE_LABELS[t],
    }));
    return NextResponse.json(types);
  }

  const { tenantService } = getGovernanceService();
  const config = {
    memberStructure: searchParams.get("memberStructure") as "single" | "multi" | undefined,
    memberCount: searchParams.get("memberCount")
      ? Number(searchParams.get("memberCount"))
      : undefined,
    partnerCount: searchParams.get("partnerCount")
      ? Number(searchParams.get("partnerCount"))
      : undefined,
    franchiseRole: searchParams.get("franchiseRole") as "franchisor" | "franchisee" | undefined,
  };

  try {
    const preview = tenantService.preview(
      entityType as Parameters<typeof tenantService.preview>[0],
      config,
    );
    return NextResponse.json(preview);
  } catch {
    return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
  }
}
