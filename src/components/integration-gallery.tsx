"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { integrationCatalog, type IntegrationDefinition } from "@/lib/integrations";

const categories = ["All", "Communication", "Productivity", "E-commerce", "Payments", "Development"];

type IntegrationConnection = {
  id: string;
  provider: string;
  name: string;
  createdAt: string;
};

export function IntegrationGallery() {
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [catalog, setCatalog] = useState<IntegrationDefinition[]>(integrationCatalog);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [showDiscordForm, setShowDiscordForm] = useState(false);
  const [showHttpForm, setShowHttpForm] = useState(false);
  const [httpConnectionName, setHttpConnectionName] = useState("External API");
  const [httpApiKey, setHttpApiKey] = useState("");
  const [httpBaseUrl, setHttpBaseUrl] = useState("https://api.example.com");
  const [httpApiKeyHeader, setHttpApiKeyHeader] = useState<"authorization" | "x-api-key">("authorization");
  const [connectionName, setConnectionName] = useState("Discord alerts");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleStatus = params.get("google");
    const googleNotice = googleStatus === "connected"
      ? "Google account connected securely. You can now use Gmail's Send email action in workflows."
      : googleStatus === "error"
        ? "Google authorization could not be completed (" + (params.get("reason") ?? "unknown_error") + "). Check the Google OAuth configuration and try again."
        : "";
    if (googleNotice) queueMicrotask(() => setNotice(googleNotice));
    if (googleStatus) window.history.replaceState({}, "", window.location.pathname);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadConnections() {
      try {
        const response = await fetch("/api/integrations", { signal: controller.signal });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "Integrations could not be loaded.");
        setConnections(Array.isArray(result.connections) ? result.connections : []);
        if (Array.isArray(result.data)) setCatalog(result.data as IntegrationDefinition[]);
        setCanManage(Boolean(result.canManage));
      } catch (error) {
        if (!controller.signal.aborted) {
          setNotice(error instanceof Error ? error.message : "Integrations could not be loaded.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadConnections();
    return () => controller.abort();
  }, []);

  const visible = useMemo(() => catalog.filter((item) => {
    const matchesCategory = category === "All" || item.category === category;
    const search = `${item.name} ${item.description} ${item.category}`.toLowerCase();
    return matchesCategory && search.includes(query.toLowerCase());
  }), [catalog, category, query]);

  async function connectDiscord() {
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "discord", name: connectionName, webhookUrl }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Discord connection could not be saved.");
      setConnections((current) => [result.data, ...current]);
      setWebhookUrl("");
      setShowDiscordForm(false);
      setNotice("Discord webhook connected. Its URL is encrypted and will not be shown again.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Discord connection could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function connectHttp() {
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "http",
          name: httpConnectionName,
          baseUrl: httpBaseUrl,
          apiKey: httpApiKey,
          apiKeyHeader: httpApiKeyHeader,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "HTTP API connection could not be saved.");
      setConnections((current) => [result.data, ...current]);
      setHttpApiKey("");
      setShowHttpForm(false);
      setNotice("HTTP API connection saved. Its API key is encrypted and cannot be retrieved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "HTTP API connection could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function removeConnection(id: string) {
    if (!window.confirm("Remove this integration connection? Existing workflow steps using it will stop working.")) return;
    try {
      const response = await fetch(`/api/integrations/${encodeURIComponent(id)}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Connection could not be removed.");
      setConnections((current) => current.filter((connection) => connection.id !== id));
      setNotice("Integration connection removed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Connection could not be removed.");
    }
  }

  return <AppShell active="Integrations"><div className="page">
    <div className="page-heading"><div><div style={{ color: "var(--accent)", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Connect your tools</div><h1>Integration library</h1><p className="subtitle">Connect services to use their actions in real workflow executions.</p></div><span className="tag">{connections.length} connected</span></div>
    {notice && <div className="toast" role="status">{notice}</div>}
    <section className="panel" style={{ marginBottom: 18 }}>
      <div className="panel-heading"><div><div className="panel-title">Workspace connections</div><div className="panel-subtitle">Credentials are encrypted at rest and scoped to this workspace.</div></div></div>
      <div style={{ padding: 14, display: "grid", gap: 10 }}>
        {loading ? <div className="empty-state">Loading connections…</div> : connections.length === 0 ? <div className="empty-state">No services connected to this workspace yet.</div> : connections.map((connection) => <div key={connection.id} className="activity-row">
          <div><strong>{connection.name}</strong><div className="activity-meta">{connection.provider} · Connected {new Date(connection.createdAt).toLocaleDateString()}</div></div>
          {canManage && <button className="btn btn-quiet" onClick={() => void removeConnection(connection.id)}>Remove</button>}
        </div>)}
      </div>
    </section>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
      <input className="field-input" aria-label="Search integrations" placeholder="Search services..." value={query} onChange={(event) => setQuery(event.target.value)} style={{ maxWidth: 300 }}/>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{categories.map((item) => <button key={item} className={category === item ? "btn btn-primary" : "btn btn-quiet"} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
    </div>
    <div className="integration-grid">{visible.map((item) => {
      const connected = connections.filter((connection) => connection.provider === (item.id === "gmail" ? "google" : item.id));
      return <article className="panel integration-card" key={item.id}>
        <div className="integration-card-head"><div className="quick-icon">{item.name.slice(0, 1)}</div><span className="tag">{item.status === "available" ? "Available" : "Planned"}</span></div>
        <h2>{item.name}</h2><p>{item.description}</p>
        <div className="activity-meta">Authentication: {item.auth}</div>
        <div className="integration-capabilities"><div><strong>Executable triggers</strong><span>{item.triggers.length ? item.triggers.join(" · ") : "No native triggers yet"}</span></div><div><strong>Executable actions</strong><span>{item.actions.length ? item.actions.join(" · ") : "No executable actions yet"}</span></div></div>
        {(item.plannedTriggers.length > 0 || item.plannedActions.length > 0) && <div className="integration-roadmap">
          <strong>Planned capabilities</strong>
          <span>{[...item.plannedTriggers, ...item.plannedActions].join(" · ")}</span>
        </div>}
        {item.id === "gmail" ? <>
          <div className="activity-meta">{connected.length} Google account(s) connected to this workspace</div>
          {canManage && <form action="/api/integrations/google/connect" method="get"><button className="btn btn-primary" type="submit">Connect Google account</button></form>}
          <p className="editor-help">Authorization uses Google OAuth 2.0 with PKCE. The Gmail Send email action is available in the workflow builder.</p>
        </> : item.id === "http" && item.status === "available" ? <>
          <div className="activity-meta">{connected.length} connection(s) in this workspace</div>
          {canManage && <button className="btn btn-primary" onClick={() => setShowHttpForm((value) => !value)}>{showHttpForm ? "Close form" : "Connect API key"}</button>}
          {showHttpForm && <form className="editor-panel" onSubmit={(event) => { event.preventDefault(); void connectHttp(); }}>
            <label className="field-label" htmlFor="http-connection-name">Connection name</label>
            <input id="http-connection-name" className="field-input" value={httpConnectionName} onChange={(event) => setHttpConnectionName(event.target.value)} minLength={2} maxLength={60} required/>
            <label className="field-label" htmlFor="http-base-url">Allowed API base URL</label>
            <input id="http-base-url" className="field-input" type="url" value={httpBaseUrl} onChange={(event) => setHttpBaseUrl(event.target.value)} placeholder="https://api.example.com" required/>
            <label className="field-label" htmlFor="http-api-key">API key / bearer token</label>
            <input id="http-api-key" className="field-input" type="password" autoComplete="new-password" value={httpApiKey} onChange={(event) => setHttpApiKey(event.target.value)} maxLength={4096} required/>
            <label className="field-label" htmlFor="http-api-key-header">Authentication header</label>
            <select id="http-api-key-header" className="field-input" value={httpApiKeyHeader} onChange={(event) => setHttpApiKeyHeader(event.target.value as "authorization" | "x-api-key")}>
              <option value="authorization">Authorization (enter full value, e.g. Bearer …)</option>
              <option value="x-api-key">X-API-Key</option>
            </select>
            <p className="editor-help">The key is encrypted at rest and scoped to this workspace. Requests are restricted to this exact API host, use HTTPS, and cannot reach private or local network addresses.</p>
            <button className="btn btn-primary" type="submit" disabled={saving || !canManage}>{saving ? "Connecting…" : "Save API connection"}</button>
          </form>}
        </> : item.id === "discord" && item.status === "available" ? <>
          <div className="activity-meta">{connected.length} connection(s) in this workspace</div>
          {canManage && <button className="btn btn-primary" onClick={() => setShowDiscordForm((value) => !value)}>{showDiscordForm ? "Close form" : "Connect Discord webhook"}</button>}
          {showDiscordForm && <form className="editor-panel" onSubmit={(event) => { event.preventDefault(); void connectDiscord(); }}>
            <label className="field-label" htmlFor="discord-connection-name">Connection name</label>
            <input id="discord-connection-name" className="field-input" value={connectionName} onChange={(event) => setConnectionName(event.target.value)} minLength={2} maxLength={60} required/>
            <label className="field-label" htmlFor="discord-webhook-url">Discord webhook URL</label>
            <input id="discord-webhook-url" className="field-input" type="url" autoComplete="off" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://discord.com/api/webhooks/…" required/>
            <p className="editor-help">The URL grants permission to post in its channel. It is encrypted before storage and cannot be retrieved from RunLattice.</p>
            <button className="btn btn-primary" type="submit" disabled={saving || !canManage}>{saving ? "Connecting…" : "Save connection"}</button>
          </form>}
        </> : <button className="btn btn-quiet" disabled title="This integration is not available yet">Coming soon</button>}
      </article>;
    })}</div>
    {visible.length === 0 && <div className="panel empty-state">No integrations match this search.</div>}
  </div></AppShell>;
}
