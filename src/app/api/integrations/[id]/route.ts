import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageWorkspace, getRequestWorkspace } from "@/lib/workspace";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const access = await getRequestWorkspace(request);
  if (access.response) return access.response;
  if (!canManageWorkspace(access.context.role)) {
    return NextResponse.json({ error: "Workspace administrator permission required." }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    const result = await prisma.integrationConnection.deleteMany({
      where: { id, organizationId: access.context.organizationId },
    });
    if (result.count === 0) return NextResponse.json({ error: "Integration connection not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to remove integration connection:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The integration connection could not be removed." }, { status: 503 });
  }
}
