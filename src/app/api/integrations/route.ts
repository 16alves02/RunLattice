import { NextResponse } from "next/server";
import { integrationCatalog } from "@/lib/integrations";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json({
    data: integrationCatalog,
    connectedCount: 0,
    note: "This is the planned integration catalog. No provider accounts are connected and no external actions are available yet.",
  });
}
