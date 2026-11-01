"use client";
import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const result = await authClient.signUp.email({ name, email, password, callbackURL: "/" });
    setLoading(false);
    if (result.error) {
      setError(result.error.message || "Unable to create your account.");
      return;
    }
    window.location.assign("/");
  }

  return <main className="auth-page"><section className="panel auth-card">
    <Link className="brand" href="/"><span className="brand-mark">RL</span><span>runlattice<span style={{ color: "var(--accent)" }}>.</span></span></Link>
    <h1>Create your account</h1><p className="subtitle">Start building automations in your workspace.</p>
    <form onSubmit={submit} className="auth-form">
      <label>Name<input className="field-input" autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Email address<input className="field-input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>Password<input className="field-input" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /><span className="activity-meta">Use at least 12 characters.</span></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Creating account…" : "Create account"}</button>
    </form>
    <p className="auth-footer">Already registered? <Link href="/sign-in">Sign in</Link></p>
  </section></main>;
}
