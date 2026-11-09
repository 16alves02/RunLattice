"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { FormEvent } from "react";
import { ShieldCheck, KeyRound, Copy } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AppShell } from "@/components/app-shell";
import { SecuritySessions } from "@/components/security-sessions";

export default function SecurityPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isPending) return <main className="auth-page"><section className="panel auth-card">Loading security settings…</section></main>;
  if (!session) {
    return <main className="auth-page"><section className="panel auth-card"><h1>Sign in required</h1><p className="subtitle">Sign in to manage your account security.</p><Link className="btn btn-primary" href="/sign-in">Continue to sign in</Link></section></main>;
  }

  const enabled = Boolean(session.user.twoFactorEnabled);

  async function beginEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const result = await authClient.twoFactor.enable({ password, issuer: "RunLattice" });
      if (result.error || !result.data) throw new Error(result.error?.message || "Could not start authenticator setup.");
      if (result.data.method !== "totp") throw new Error("The authenticator setup did not return a TOTP credential.");
      const uri = result.data.totpURI;
      setTotpUri(uri);
      setManualKey(new URL(uri).searchParams.get("secret") || "");
      setBackupCodes(result.data.backupCodes || []);
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start authenticator setup.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmEnrollment() {
    setError("");
    setLoading(true);
    try {
      const result = await authClient.twoFactor.verifyTotp({ code: code.trim(), trustDevice: false });
      if (result.error) throw new Error(result.error.message || "The authenticator code is invalid.");
      setNotice("Two-factor authentication is now enabled for this account.");
      router.refresh();
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not verify the authenticator code.");
      setLoading(false);
    }
  }

  async function regenerateCodes() {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const result = await authClient.twoFactor.generateBackupCodes({ password });
      if (result.error || !result.data) throw new Error(result.error?.message || "Could not regenerate recovery codes.");
      setBackupCodes(result.data.backupCodes || []);
      setPassword("");
      setNotice("New recovery codes generated. Previous codes are no longer valid.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not regenerate recovery codes.");
    } finally {
      setLoading(false);
    }
  }

  async function copyCodes() {
    await navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
  }

  return <AppShell active="Security"><div className="page">
    <div className="page-heading"><div><h1>Account security</h1><p className="subtitle">Protect your RunLattice account and recovery methods.</p></div><span className="tag"><ShieldCheck size={13}/> Security</span></div>
    <section className="panel" style={{ padding: 22, marginBottom: 16 }}>
      <div className="panel-heading"><div><div className="panel-title">Authenticator app</div><div className="panel-subtitle">Use TOTP with an authenticator app. Recovery codes are one-time use.</div></div><span className="status status-active">{enabled ? "Enabled" : "Required"}</span></div>
      {enabled ? <div className="auth-form">
        <p className="panel-subtitle">Two-factor authentication is active. Sign-ins require a current authenticator code unless you use a one-time recovery code.</p>
        <label>Account password to regenerate recovery codes<input className="field-input" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
        <button className="btn" type="button" disabled={loading || !password} onClick={regenerateCodes}>Regenerate recovery codes</button>
        {backupCodes.length > 0 && <div className="panel" style={{ padding: 14 }}>
          <div className="panel-title">New recovery codes</div>
          <p className="panel-subtitle">These replace all previous codes. Save them in a password manager now.</p>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", padding: 12, background: "var(--surface-2)", borderRadius: 8 }}>{backupCodes.join("\\n")}</pre>
          <button className="btn" type="button" onClick={copyCodes}><Copy size={13}/>{copied ? "Copied" : "Copy recovery codes"}</button>
        </div>}
      </div> : !totpUri ? <form className="auth-form" onSubmit={beginEnrollment}>
        <p className="panel-subtitle">MFA setup is required before using the workspace. Enter your password to create an authenticator registration.</p>
        <label>Current account password<input className="field-input" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
        <button className="btn btn-primary" type="submit" disabled={loading || !password}>{loading ? "Preparing…" : "Set up authenticator"}</button>
      </form> : <div className="auth-form">
        <p className="panel-subtitle">Add RunLattice to your authenticator app using the setup key below. Keep this page private.</p>
        <label>Authenticator setup key<input className="field-input" readOnly value={manualKey} onFocus={event => event.currentTarget.select()} /></label>
        <p className="activity-meta">The key is sensitive. Do not share it or send it to anyone. The authenticator URI is available for compatible apps.</p>
        <label>Verification code<input className="field-input" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label>
        <button className="btn btn-primary" type="button" disabled={loading || code.length !== 6} onClick={() => void confirmEnrollment()}>{loading ? "Verifying…" : "Verify and enable MFA"}</button>
        {backupCodes.length > 0 && <div className="panel" style={{ padding: 14 }}>
          <div className="panel-title">Save your recovery codes now</div>
          <p className="panel-subtitle">Each code works once. Store them in a password manager. They will not be shown again after leaving this step.</p>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", padding: 12, background: "var(--surface-2)", borderRadius: 8 }}>{backupCodes.join("\n")}</pre>
          <button className="btn" type="button" onClick={copyCodes}><Copy size={13}/>{copied ? "Copied" : "Copy recovery codes"}</button>
        </div>}
      </div>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      {notice && <p className="panel-subtitle" role="status">{notice}</p>}
    </section>
    <section className="panel" style={{ padding: 22 }}>
      <div className="panel-title"><KeyRound size={15}/> Passkeys</div>
      <p className="panel-subtitle">Passkey support is not yet enabled on this deployment. It will be added after the WebAuthn package, database migration and browser-based registration tests are validated.</p>
    </section>
    <SecuritySessions />
  </div></AppShell>;
}
