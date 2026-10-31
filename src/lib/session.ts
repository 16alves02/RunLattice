import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function getCurrentUser() {
  if (process.env.NODE_ENV === "production" && !process.env.BETTER_AUTH_SECRET) return null;
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) return null;
  return user;
}
