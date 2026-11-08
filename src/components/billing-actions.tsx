"use client";

import { useState } from "react";

type CheckoutPlan = "pro" | "team" | "business";
type BillingInterval = "month" | "year";
type Availability = Record<CheckoutPlan, Record<BillingInterval, boolean>>;

export function BillingActions({
  availability,
  portalReady,
}: {
  availability: Availability;
  portalReady: boolean;
}) {
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [busy, setBusy] = useState<CheckoutPlan | "portal" | null>(null);
  const [error, setError] = useState("");

  async function redirectTo(action: "checkout" | "portal", plan?: CheckoutPlan) {
    setError("");
    setBusy(plan ?? "portal");
    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "checkout" ? { action, plan, interval } : { action }),
      });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "The billing action could not be completed.");
      window.location.assign(result.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The billing action could not be completed.");
      setBusy(null);
    }
  }

  const plans: { key: CheckoutPlan; label: string }[] = [
    { key: "pro", label: "Pro" },
    { key: "team", label: "Teams" },
    { key: "business", label: "Business" },
  ];

  return <div className="billing-actions">
    <div className="billing-interval" role="group" aria-label="Billing interval">
      <button type="button" className={interval === "month" ? "btn btn-primary" : "btn"} onClick={() => setInterval("month")} aria-pressed={interval === "month"}>Monthly</button>
      <button type="button" className={interval === "year" ? "btn btn-primary" : "btn"} onClick={() => setInterval("year")} aria-pressed={interval === "year"}>Annual</button>
    </div>
    {plans.map((plan) => {
      const ready = availability[plan.key][interval];
      return <button key={plan.key} className={plan.key === "pro" ? "btn btn-primary" : "btn"} disabled={busy !== null || !ready} onClick={() => void redirectTo("checkout", plan.key)}>
        {busy === plan.key ? "Opening checkout…" : ready ? `Choose ${plan.label}` : `${plan.label} — coming soon`}
      </button>;
    })}
    {!plans.some((plan) => availability[plan.key][interval]) && (
      <p className="panel-subtitle">Stripe sandbox prices for this billing interval are not configured yet.</p>
    )}
    {portalReady && <button className="btn" disabled={busy !== null} onClick={() => void redirectTo("portal")}>
      {busy === "portal" ? "Opening portal…" : "Manage subscription"}
    </button>}
    {error && <p role="alert" className="billing-error">{error}</p>}
  </div>;
}
