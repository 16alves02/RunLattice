"use client";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const [loading, setLoading] = useState(false);
  async function signOut() {
    setLoading(true);
    await authClient.signOut();
    window.location.assign("/sign-in");
  }
  return <button className="sign-out-button" type="button" onClick={() => void signOut()} disabled={loading}>
    <LogOut size={14}/>{loading ? "Signing out…" : "Sign out"}
  </button>;
}
