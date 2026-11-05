"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

type AuthFormProps = { mode: "sign-in" | "sign-up" };

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isSignUp = mode === "sign-up";

  async function ensureWorkspace() {
    const organizations = await authClient.organization.list();
    if (organizations.error) throw new Error(organizations.error.message || "Could not load your workspaces.");

    let organizationId = organizations.data?.[0]?.id;
    if (!organizationId) {
      const created = await authClient.organization.create({
        name: isSignUp ? `${name.trim()}'s workspace` : "Personal workspace",
        slug: `workspace-${crypto.randomUUID()}`,
      });
      if (created.error || !created.data) {
        throw new Error(created.error?.message || "Could not create your workspace.");
      }
      organizationId = created.data.id;
    }

    const active = await authClient.organization.setActive({ organizationId });
    if (active.error) throw new Error(active.error.message || "Could not select your workspace.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        const result = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
        });
        if (result.error) throw new Error(result.error.message || "Account creation failed.");
      } else {
        const result = await authClient.signIn.email({ email: email.trim(), password });
        if (result.error) throw new Error(result.error.message || "Sign-in failed.");
      }

      await ensureWorkspace();
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "An unexpected authentication error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="brand auth-brand" href="/">
          <span className="brand-mark">RL</span>
          <span>runlattice<span style={{ color: "var(--accent)" }}>.</span></span>
        </Link>
        <div className="auth-heading">
          <h1>{isSignUp ? "Create your account" : "Welcome back"}</h1>
          <p className="subtitle">{isSignUp ? "Start building automations in your workspace." : "Sign in to continue to your workspace."}</p>
        </div>

        {error && <div className="toast" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignUp && (
            <label className="auth-field">
              <span>Full name</span>
              <input autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
            </label>
          )}
          <label className="auth-field">
            <span>Email</span>
            <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input type="password" autoComplete={isSignUp ? "new-password" : "current-password"} required minLength={isSignUp ? 12 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {isSignUp && <p className="auth-note">Use at least 12 characters. Email verification will be enabled when the transactional email service is configured.</p>}
          <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          {isSignUp ? "Already have an account?" : "New to RunLattice?"}{" "}
          <Link href={isSignUp ? "/sign-in" : "/sign-up"}>{isSignUp ? "Sign in" : "Create an account"}</Link>
        </p>
      </section>
    </main>
  );
}
