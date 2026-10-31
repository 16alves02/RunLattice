import { NextResponse } from "next/server";
import { integrationCatalog } from "@/lib/integrations";

export async function GET() {
  return NextResponse.json({
    data: integrationCatalog,
    connectedCount: 0,
    note: "This is the planned integration catalog. No provider accounts are connected and no external actions are available yet.",
  });
}
