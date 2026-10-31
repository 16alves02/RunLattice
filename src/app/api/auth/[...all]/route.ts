import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handlers = toNextJsHandler(auth);

function isConfigured() {
  return process.env.NODE_ENV !== "production" || Boolean(process.env.BETTER_AUTH_SECRET);
}

export async function GET(request: Request) {
  if (!isConfigured()) return NextResponse.json({ error: "Authentication is not configured on this deployment." }, { status: 503 });
  return handlers.GET(request);
}

export async function POST(request: Request) {
  if (!isConfigured()) return NextResponse.json({ error: "Authentication is not configured on this deployment." }, { status: 503 });
  return handlers.POST(request);
}
