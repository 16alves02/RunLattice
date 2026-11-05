"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function AuthControls() {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <button className="btn btn-quiet" type="button" onClick={() => void handleSignOut()} aria-label="Sign out">
      <LogOut size={13} />
      Sign out
    </button>
  );
}
