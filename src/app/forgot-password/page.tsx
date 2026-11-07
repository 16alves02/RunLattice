"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { BrandLogo } from "@/components/brand-logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: \`\${window.location.origin}/reset-password\`,
      });
      if (result.error) throw new Error(result.error.message || "Unable to request a password reset.");
      setMessage("If this address belongs to an account, a password reset link will be sent.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to request a password reset.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-page"><section className="panel auth-card">
    <BrandLogo variant="auth" />
    <h1>Reset your password</h1>
    <p className="subtitle">Enter your account email and we will send a secure reset link.</p>
    <form onSubmit={submit} className="auth-form">
      <label>Email address<input className="field-input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {message && <p className="panel-subtitle" role="status">{message}</p>}
      <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</button>
    </form>
    <p className="auth-footer"><Link href="/sign-in">Back to sign in</Link></p>
  </section></main>;
}
