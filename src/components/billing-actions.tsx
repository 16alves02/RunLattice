"use client";

import { useState } from "react";

export function BillingActions({ checkoutReady, portalReady }: { checkoutReady: boolean; portalReady: boolean }) {
  const [busy, setBusy] = useState<"pro" | "team" | "portal" | null>(null);
  const [error, setError] = useState("");

  async function redirectTo(action: "checkout" | "portal", plan?: "pro" | "team") {
    setError("");
    setBusy(plan ?? "portal");
    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "checkout" ? { action, plan } : { action }),
      });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "The billing action could not be completed.");
      window.location.assign(result.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The billing action could not be completed.");
      setBusy(null);
    }
  }

  return <div className="billing-actions">
    {checkoutReady ? <>
      <button className="btn btn-primary" disabled={busy !== null} onClick={() => void redirectTo("checkout", "pro")}>
        {busy === "pro" ? "Opening checkout…" : "Choose Pro"}
      </button>
      <button className="btn" disabled={busy !== null} onClick={() => void redirectTo("checkout", "team")}>
        {busy === "team" ? "Opening checkout…" : "Choose Team"}
      </button>
    </> : <p className="panel-subtitle">Stripe sandbox setup is pending. Checkout is not enabled yet.</p>}
    {portalReady && <button className="btn" disabled={busy !== null} onClick={() => void redirectTo("portal")}>
      {busy === "portal" ? "Opening portal…" : "Manage subscription"}
    </button>}
    {error && <p role="alert" className="billing-error">{error}</p>}
  </div>;
}
