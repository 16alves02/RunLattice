"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { BrandLogo } from "@/components/brand-logo";

export default function TwoFactorPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [method, setMethod] = useState<"totp" | "backup">("totp");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = method === "totp"
        ? await authClient.twoFactor.verifyTotp({ code: code.trim(), trustDevice: false })
        : await authClient.twoFactor.verifyBackupCode({ code: code.trim(), trustDevice: false });
      if (result.error) throw new Error(result.error.message || "The verification code is invalid.");
      router.replace("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to verify the code.");
      setLoading(false);
    }
  }

  return <main className="auth-page"><section className="panel auth-card">
    <BrandLogo variant="auth" />
    <h1>Verify your identity</h1>
    <p className="subtitle">Enter the code from your authenticator app to complete sign-in.</p>
    <form onSubmit={submit} className="auth-form">
      <label>Verification code<input className="field-input" inputMode="text" autoComplete="one-time-code" required maxLength={32} value={code} onChange={(event) => setCode(event.target.value)} /></label>
      <div className="auth-footer">
        <button className="btn" type="button" onClick={() => { setMethod(method === "totp" ? "backup" : "totp"); setCode(""); setError(""); }}>
          {method === "totp" ? "Use a recovery code" : "Use authenticator app"}
        </button>
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={loading || !code.trim()}>{loading ? "Verifying…" : "Verify and continue"}</button>
    </form>
  </section></main>;
}
