"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { ensureActiveWorkspace } from "@/lib/auth-workspace-client";
import { BrandLogo } from "@/components/brand-logo";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await authClient.signUp.email({ name, email, password, callbackURL: "/onboarding" });
      if (result.error) throw new Error(result.error.message || "Unable to create your account.");
      if (!result.data?.token) {
        router.push("/thank-you");
        return;
      }
      await ensureActiveWorkspace(`${name.trim()}'s workspace`);
      router.push("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create your account.");
      setLoading(false);
    }
  }

  return <main className="auth-page"><section className="panel auth-card">
    <BrandLogo variant="auth" />
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
