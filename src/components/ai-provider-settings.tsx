"use client";

import { useEffect, useState, type FormEvent } from "react";

type Provider = "openai" | "anthropic" | "google";
type Credential = { provider: Provider; model: string; updatedAt: string };

const providerNames: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
};

export function AIProviderSettings() {
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState("gpt-4.1-mini");
  const [apiKey, setApiKey] = useState("");
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadCredentials() {
    setLoading(true);
    try {
      const response = await fetch("/api/ai/providers");
      const result = await response.json() as { data?: Credential[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not load provider settings.");
      setCredentials(result.data ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load provider settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadCredentials(); }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/ai/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, apiKey }),
      });
      const result = await response.json() as { data?: Credential; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save provider settings.");
      setApiKey("");
      setMessage(`${providerNames[provider]} is connected to this workspace. The key is encrypted and will not be shown again.`);
      await loadCredentials();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save provider settings.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(selected: Provider) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/ai/providers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selected }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not remove provider.");
      setMessage(`${providerNames[selected]} key removed. AI planning will use the platform provider if configured.`);
      await loadCredentials();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove provider.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="panel">
    <div className="panel-title">Bring your own AI key (BYOK)</div>
    <p className="panel-subtitle">Connect an API key owned by your organisation. Requests made with this key are billed directly by the AI provider and do not consume RunLattice included AI credits. Keys are encrypted at rest and never displayed after saving.</p>
    <form onSubmit={save} className="ai-provider-form">
      <label className="field-label" htmlFor="ai-provider">Provider</label>
      <select id="ai-provider" value={provider} onChange={(event) => {
        const next = event.target.value as Provider;
        setProvider(next);
        setModel(next === "openai" ? "gpt-4.1-mini" : next === "anthropic" ? "claude-sonnet-4-5" : "gemini-2.5-flash");
      }}>
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
        <option value="google">Google Gemini</option>
      </select>
      <label className="field-label" htmlFor="ai-model">Model ID</label>
      <input id="ai-model" value={model} onChange={(event) => setModel(event.target.value)} minLength={1} maxLength={120} required />
      <label className="field-label" htmlFor="ai-api-key">API key</label>
      <input id="ai-api-key" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} minLength={12} maxLength={500} placeholder="Paste the provider API key" required />
      <button className="btn btn-primary" type="submit" disabled={busy || loading || !apiKey || !model.trim()}>
        {busy ? "Saving…" : "Save encrypted API key"}
      </button>
    </form>
    {loading ? <p className="panel-subtitle">Loading workspace provider settings…</p> : <div className="ai-provider-list">
      <h3>Connected workspace providers</h3>
      {credentials.length === 0 ? <p className="panel-subtitle">No workspace-owned AI keys are connected. The platform provider is used when available.</p> : credentials.map((credential) => <div className="ai-provider-row" key={credential.provider}>
        <div><strong>{providerNames[credential.provider]}</strong><div className="panel-subtitle">{credential.model} · Updated {new Date(credential.updatedAt).toLocaleDateString("pt-PT")}</div></div>
        <button type="button" className="btn" disabled={busy} onClick={() => void remove(credential.provider)}>Remove</button>
      </div>)}
    </div>}
    {message && <p className="billing-success" role="status">{message}</p>}
    {error && <p className="billing-error" role="alert">{error}</p>}
  </div>;
}
