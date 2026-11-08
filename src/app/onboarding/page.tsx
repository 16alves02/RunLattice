"use client";

import { useEffect, useState } from "react";
import { ensureActiveWorkspace } from "@/lib/auth-workspace-client";
import { BrandLogo } from "@/components/brand-logo";

export default function OnboardingPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void ensureActiveWorkspace("Personal workspace")
      .then(() => {
        if (active) window.location.replace("/");
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Workspace setup failed.");
      });
    return () => { active = false; };
  }, []);

  return <main className="auth-page"><section className="panel auth-card">
    <BrandLogo variant="auth" />
    <h1>Preparing your workspace</h1>
    <p className="subtitle">Your account is verified. We are setting up your first workspace.</p>
    {error ? <><p className="auth-error" role="alert">{error}</p><a className="btn" href="/sign-in">Return to sign in</a></> : <p className="panel-subtitle" role="status">Setting up your workspace…</p>}
  </section></main>;
}
