import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  if (!session.user.twoFactorEnabled) redirect("/security");
  return <Dashboard />;
}
