"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

export function SecurityPassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (newPassword !== confirmation) {
      setError("The new passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) throw new Error(result.error.message || "Could not change your password.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setNotice("Password changed. Other active sessions have been revoked.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not change your password.");
    } finally {
      setLoading(false);
    }
  }

  return <section className="panel" style={{ padding: 22, marginTop: 16 }}>
    <div className="panel-title">Change password</div>
    <p className="panel-subtitle">Use at least 12 characters. Changing your password signs out other devices.</p>
    <form className="auth-form" onSubmit={submit}>
      <label>Current password<input className="field-input" type="password" autoComplete="current-password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></label>
      <label>New password<input className="field-input" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={event => setNewPassword(event.target.value)} /></label>
      <label>Confirm new password<input className="field-input" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {notice && <p className="panel-subtitle" role="status">{notice}</p>}
      <button className="btn btn-primary" type="submit" disabled={loading || !currentPassword || newPassword.length < 12 || !confirmation}>{loading ? "Updating…" : "Change password"}</button>
    </form>
  </section>;
}
