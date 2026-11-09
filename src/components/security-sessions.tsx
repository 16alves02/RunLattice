"use client";

import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

type SessionItem = {
  token: string;
  createdAt: Date | string;
  expiresAt: Date | string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export function SecuritySessions() {
  const { data: currentSession } = authClient.useSession();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await authClient.listSessions();
      if (result.error) throw new Error(result.error.message || "Could not load active sessions.");
      setSessions((result.data ?? []) as SessionItem[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load active sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function revoke(token: string) {
    setBusy(true);
    setError("");
    try {
      const result = await authClient.revokeSession({ token });
      if (result.error) throw new Error(result.error.message || "Could not revoke this session.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not revoke this session.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeOthers() {
    setBusy(true);
    setError("");
    try {
      const result = await authClient.revokeOtherSessions();
      if (result.error) throw new Error(result.error.message || "Could not revoke other sessions. Sign in again and retry.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not revoke other sessions.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel" style={{ padding: 22, marginTop: 16 }}>
    <div className="panel-heading"><div><div className="panel-title">Active sessions</div><div className="panel-subtitle">Review devices signed in to your account and end sessions you do not recognise.</div></div><button className="btn" type="button" disabled={busy || loading || sessions.length < 2} onClick={() => void revokeOthers()}>Sign out other devices</button></div>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {loading ? <p className="panel-subtitle">Loading sessions…</p> : sessions.length === 0 ? <p className="panel-subtitle">No active sessions were returned.</p> : <div className="activity-list">
      {sessions.map((item, index) => <div className="activity-item" key={item.token}>
        <span className="activity-dot" style={{ background: "#83d3a1" }}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="activity-title">{item.userAgent || "Unknown device"}{item.token === currentSession?.session.token ? " · This device" : ""}</div>
          <div className="activity-meta">Started {new Date(item.createdAt).toLocaleString("en-GB")} · Expires {new Date(item.expiresAt).toLocaleString("en-GB")}{item.ipAddress ? " · " + item.ipAddress : ""}</div>
        </div>
        <button className="btn" type="button" disabled={busy} onClick={() => void revoke(item.token)}>Revoke</button>
      </div>)}
    </div>}
  </section>;
}
