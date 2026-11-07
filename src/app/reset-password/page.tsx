"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { BrandLogo } from "@/components/brand-logo";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!token) return setError("This reset link is missing or invalid.");
    if (password !== confirmation) return setError("The passwords do not match.");
    setLoading(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) throw new Error(result.error.message || "Unable to reset your password.");
      setSuccess(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to reset your password.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-page"><section className="panel auth-card">
    <BrandLogo variant="auth" />
    <h1>Choose a new password</h1>
    <p className="subtitle">Use at least 12 characters. Your other sessions will be revoked.</p>
    {success ? <><p className="panel-subtitle" role="status">Your password has been changed.</p><p className="auth-footer"><Link href="/sign-in">Continue to sign in</Link></p></> : <form onSubmit={submit} className="auth-form">
      <label>New password<input className="field-input" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <label>Confirm password<input className="field-input" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={loading || !token}>{loading ? "Updating…" : "Update password"}</button>
    </form>}
    {!success && <p className="auth-footer"><Link href="/sign-in">Back to sign in</Link></p>}
  </section></main>;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="auth-page"><section className="panel auth-card">Loading secure reset…</section></main>}><ResetPasswordForm /></Suspense>;
}
