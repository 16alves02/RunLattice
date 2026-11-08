import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      service: "runlattice-web",
      checks: { database: "ok" },
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      status: "degraded",
      service: "runlattice-web",
      checks: { database: "error" },
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}
