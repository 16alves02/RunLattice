"use client";
import { useEffect, useState } from "react";
type Consent = "accepted" | "rejected" | null;
const STORAGE_KEY = "runlattice-analytics-consent";
export function CookieConsent() {
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "accepted" || saved === "rejected") setConsent(saved);
    } finally { setReady(true); }
  }, []);
  useEffect(() => {
    if (consent !== "accepted") return;
    const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
    if (!domain) return;
    const script = document.createElement("script");
    script.defer = true;
    script.dataset.domain = domain;
    script.src = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || "https://plausible.io/js/script.js";
    script.setAttribute("data-runlattice-analytics", "true");
    document.head.appendChild(script);
    return () => script.remove();
  }, [consent]);
  function choose(value: Exclude<Consent, null>) {
    try { window.localStorage.setItem(STORAGE_KEY, value); } catch { /* Keep the in-memory choice for this visit. */ }
    setConsent(value);
  }
  if (!ready) return null;
  if (consent !== null) return <button type="button" className="consent-settings" onClick={() => setConsent(null)} aria-label="Change privacy preferences">Privacy settings</button>;
  return <aside className="consent-banner" aria-label="Privacy preferences" role="region">
    <div><strong>Privacy preferences</strong><p>Essential storage keeps your account secure. Optional analytics remain off unless you allow them.</p></div>
    <div className="consent-actions"><button type="button" className="btn btn-quiet" onClick={() => choose("rejected")}>Reject optional</button><button type="button" className="btn btn-primary" onClick={() => choose("accepted")}>Allow analytics</button></div>
  </aside>;
}