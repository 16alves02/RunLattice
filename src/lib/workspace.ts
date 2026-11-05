import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type WorkspaceContext = {
  userId: string;
  organizationId: string;
};

export async function getRequestWorkspace(request: Request): Promise<
  | { context: WorkspaceContext; response?: never }
  | { context?: never; response: NextResponse }
> {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return { response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }

  const activeOrganizationId = session.session.activeOrganizationId;
  const membership = activeOrganizationId
    ? await prisma.member.findFirst({
        where: { userId: session.user.id, organizationId: activeOrganizationId },
        select: { organizationId: true },
      })
    : await prisma.member.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
        select: { organizationId: true },
      });

  if (!membership) {
    return { response: NextResponse.json({ error: "A workspace membership is required." }, { status: 403 }) };
  }

  return {
    context: {
      userId: session.user.id,
      organizationId: membership.organizationId,
    },
  };
}

export async function requireServerWorkspace(): Promise<WorkspaceContext> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) redirect("/sign-in");

  const activeOrganizationId = session.session.activeOrganizationId;
  const membership = activeOrganizationId
    ? await prisma.member.findFirst({
        where: { userId: session.user.id, organizationId: activeOrganizationId },
        select: { organizationId: true },
      })
    : await prisma.member.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
        select: { organizationId: true },
      });

  if (!membership) redirect("/sign-in?error=workspace-required");

  return { userId: session.user.id, organizationId: membership.organizationId };
}
