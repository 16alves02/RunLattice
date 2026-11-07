"use client";
import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { ensureActiveWorkspace } from "@/lib/auth-workspace-client";
import { BrandLogo } from "@/components/brand-logo";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await authClient.signIn.email({ email, password, callbackURL: "/" });
      if (result.error) throw new Error(result.error.message || "Unable to sign in. Check your details.");
      await ensureActiveWorkspace("Personal workspace");
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in. Check your details.");
      setLoading(false);
    }
  }

  return <main className="auth-page"><section className="panel auth-card">
    <BrandLogo variant="auth" />
    <h1>Welcome back</h1><p className="subtitle">Sign in to access your workflows.</p>
    <form onSubmit={submit} className="auth-form">
      <label>Email address<input className="field-input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>Password<input className="field-input" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
    </form>
    <p className="auth-footer"><Link href="/forgot-password">Forgot password?</Link></p><p className="auth-footer">New to RunLattice? <Link href="/sign-up">Create an account</Link></p>
  </section></main>;
}
