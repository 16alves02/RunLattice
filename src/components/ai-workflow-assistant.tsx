"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import type { WorkflowDefinition } from "@/lib/types";

type Plan = { name: string; description: string; definition: WorkflowDefinition };

export function AIWorkflowAssistant() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [notice, setNotice] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  async function generatePlan() {
    setGenerating(true);
    setNotice("");
    setPlan(null);
    try {
      const response = await fetch("/api/ai/workflow-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "The assistant could not create a plan.");
      setPlan(result.data);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The assistant could not create a plan.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveDraft() {
    if (!plan) return;
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.data?.id !== "string") throw new Error(result.error ?? "The workflow draft could not be saved.");
      router.push(`/workflows/new?workflow=${encodeURIComponent(result.data.id)}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The workflow draft could not be saved.");
      setSaving(false);
    }
  }

  return <AppShell active="AI assistant"><div className="page">
    <div className="page-heading"><div><div style={{ color: "var(--accent)", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Describe it. Review it. Build it.</div><h1>AI workflow assistant</h1><p className="subtitle">Describe an automation in plain language and receive an editable workflow draft.</p></div><span className="tag">Preview</span></div>
    <div className="demo-notice" role="note">AI generation is disabled by default. Before enabling it on a public deployment, RunLattice needs authentication, workspace permissions and request rate limits. The assistant never activates or runs a workflow.</div>
    {notice && <div className="toast" role="alert">{notice}</div>}
    <section className="panel ai-assistant-panel"><div className="panel-heading"><div><div className="panel-title">What would you like to automate?</div><div className="panel-subtitle">Be specific about the event, conditions and actions.</div></div><Sparkles size={17} color="var(--accent)"/></div><div style={{ padding: 20 }}><textarea className="field-input" rows={5} maxLength={2000} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="When a new order is paid in Shopify, prepare a confirmation email and add the order to Google Sheets."/><div className="ai-prompt-footer"><span className="activity-meta">{prompt.length}/2,000 characters</span><button className="btn btn-primary" onClick={() => void generatePlan()} disabled={generating || prompt.trim().length < 10}><Sparkles size={14}/>{generating ? "Generating…" : "Generate workflow"}</button></div></div></section>
    {plan && <section className="panel" style={{ marginTop: 18 }}><div className="panel-heading"><div><div className="panel-title">Review generated workflow</div><div className="panel-subtitle">Nothing has been saved, activated or executed.</div></div><span className="tag"><CheckCircle2 size={11}/> Validated draft</span></div><div style={{ padding: 20 }}><h2 style={{ fontSize: 17, margin: "0 0 7px" }}>{plan.name}</h2><p className="subtitle">{plan.description}</p><div className="ai-plan-steps">{plan.definition.nodes.map((node, index) => <div className="ai-plan-step" key={node.id}><span className="ai-plan-number">{index + 1}</span><div><strong>{node.title}</strong><div className="activity-meta">{node.kind} · {node.detail}</div></div></div>)}</div><div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 20 }}><button className="btn btn-primary" onClick={() => void saveDraft()} disabled={saving}>{saving ? "Saving…" : "Save as draft"}<ArrowRight size={13}/></button><button className="btn btn-quiet" onClick={() => setPlan(null)}>Discard</button></div></div></section>}
  </div></AppShell>;
}
