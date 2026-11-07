"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, FlaskConical, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import type { ConditionConfig, WorkflowDefinition } from "@/lib/types";

type Plan = {
  name: string;
  description: string;
  rationale: string;
  assumptions: string[];
  requiredIntegrations: string[];
  requiredPermissions: string[];
  sideEffects: string[];
  missingIntegrations: string[];
  setupRequiredActions: string[];
  executionReadiness: "review_required" | "setup_required";
  definition: WorkflowDefinition;
};

type Usage = { requestsUsed: number; tokensUsed: number; monthlyRequestLimit: number; monthlyTokenLimit: number; provider: string; model: string; tokensThisRequest: number };

type DryRun = {
  simulationOnly: true;
  externalSideEffectPerformed: false;
  selectedPath: Array<{ nodeId: string; title: string; kind: string; outcome: string }>;
  note: string;
};

export function AIWorkflowAssistant() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [dryRun, setDryRun] = useState<DryRun | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [notice, setNotice] = useState("");
  const [generating, setGenerating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  async function generatePlan() {
    setGenerating(true);
    setNotice("");
    setPlan(null);
    setDryRun(null);
    setUsage(null);
    try {
      const response = await fetch("/api/ai/workflow-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "The assistant could not create a plan.");
      setPlan(result.data);
      setUsage(result.usage ?? null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The assistant could not create a plan.");
    } finally {
      setGenerating(false);
    }
  }

  function updateNode(nodeId: string, field: "title" | "detail", value: string) {
    setPlan((current) => current ? {
      ...current,
      definition: {
        ...current.definition,
        nodes: current.definition.nodes.map((node) => node.id === nodeId ? { ...node, [field]: value } : node),
      },
    } : current);
    setDryRun(null);
  }

  function updateActionMessage(nodeId: string, message: string) {
    setPlan((current) => current ? {
      ...current,
      definition: {
        ...current.definition,
        nodes: current.definition.nodes.map((node) => node.id === nodeId && node.kind === "action"
          && node.config && "integrationId" in node.config
          ? { ...node, config: { ...node.config, message } }
          : node),
      },
    } : current);
    setDryRun(null);
  }

  function updateCondition(nodeId: string, field: "path" | "operator" | "value", value: string) {
    setPlan((current) => current ? {
      ...current,
      definition: {
        ...current.definition,
        nodes: current.definition.nodes.map((node) => {
          if (node.id !== nodeId || node.kind !== "condition" || !node.config || !("operator" in node.config)) return node;
          const config = node.config;
          if (field === "path") return { ...node, config: { ...config, path: value } };
          if (field === "operator") {
            const operator = value as ConditionConfig["operator"];
            const nextConfig: ConditionConfig = operator === "exists"
              ? { path: config.path, operator }
              : {
                  path: config.path,
                  operator,
                  value: config.value ?? (operator === "greater_than" || operator === "less_than" ? 0 : ""),
                };
            return { ...node, config: nextConfig };
          }
          const nextValue = config.operator === "greater_than" || config.operator === "less_than"
            ? Number(value)
            : typeof config.value === "number"
              ? Number(value)
              : typeof config.value === "boolean"
                ? value === "true"
                : value;
          return { ...node, config: { ...config, value: nextValue } };
        }),
      },
    } : current);
    setDryRun(null);
  }

  async function simulatePlan() {
    if (!plan) return;
    setTesting(true);
    setNotice("");
    setDryRun(null);
    try {
      const response = await fetch("/api/ai/workflow-plan/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition: plan.definition, input: {} }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "The workflow could not be simulated.");
      setDryRun(result.data);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The workflow could not be simulated.");
    } finally {
      setTesting(false);
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
        body: JSON.stringify({ name: plan.name, description: plan.description, definition: plan.definition }),
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
    <div className="page-heading"><div><div style={{ color: "var(--accent)", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Describe it. Review it. Build it.</div><h1>AI workflow architect</h1><p className="subtitle">Describe an automation, inspect its assumptions and missing integrations, then test a side-effect-free simulation.</p></div><span className="tag">Preview</span></div>
    <div className="demo-notice" role="note">AI generation remains disabled by default. Configure a server-side provider key and enable it only after deployment review. Requests are workspace-authenticated and subject to monthly request and token budgets. The assistant never activates or executes a workflow.</div>
    {notice && <div className="toast" role="alert">{notice}</div>}
    <section className="panel ai-assistant-panel"><div className="panel-heading"><div><div className="panel-title">What would you like to automate?</div><div className="panel-subtitle">Describe the event, conditions, actions and expected result.</div></div><Sparkles size={17} color="var(--accent)"/></div><div style={{ padding: 20 }}><textarea className="field-input" rows={5} maxLength={2000} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="When a new order is paid, prepare a confirmation message and add the order to a spreadsheet."/><div className="ai-prompt-footer"><span className="activity-meta">{prompt.length}/2,000 characters</span><button className="btn btn-primary" onClick={() => void generatePlan()} disabled={generating || prompt.trim().length < 10}><Sparkles size={14}/>{generating ? "Planning…" : "Create plan"}</button></div></div></section>
    {plan && <section className="panel" style={{ marginTop: 18 }}><div className="panel-heading"><div><div className="panel-title">Review and edit proposal</div><div className="panel-subtitle">Edit the draft before saving. Nothing has been activated or executed.</div></div><span className="tag"><CheckCircle2 size={11}/> Schema validated</span></div><div style={{ padding: 20 }}>
      <label className="field-label" htmlFor="ai-plan-name">Workflow name</label><input id="ai-plan-name" className="field-input" value={plan.name} maxLength={80} onChange={(event) => setPlan({ ...plan, name: event.target.value })}/>
      <label className="field-label" htmlFor="ai-plan-description" style={{ display: "block", marginTop: 12 }}>Description</label><textarea id="ai-plan-description" className="field-input" rows={2} value={plan.description} maxLength={300} onChange={(event) => setPlan({ ...plan, description: event.target.value })}/>
      <div className="panel-subtitle" style={{ marginTop: 18 }}>Why this design</div><p className="subtitle">{plan.rationale}</p>
      <div className="ai-plan-steps">{plan.definition.nodes.map((node, index) => <div className="ai-plan-step" key={node.id}><span className="ai-plan-number">{index + 1}</span><div style={{ flex: 1, minWidth: 0 }}><input aria-label={`Step ${index + 1} title`} className="field-input" value={node.title} maxLength={100} onChange={(event) => updateNode(node.id, "title", event.target.value)}/><input aria-label={`Step ${index + 1} details`} className="field-input" style={{ marginTop: 6 }} value={node.detail} maxLength={500} onChange={(event) => updateNode(node.id, "detail", event.target.value)}/>{node.kind === "action" && node.config && "integrationId" in node.config && <><label className="field-label" style={{ display: "block", marginTop: 8 }}>Action message</label><textarea aria-label={`Step ${index + 1} action message`} className="field-input" rows={2} maxLength={2000} value={node.config.message ?? ""} onChange={(event) => updateActionMessage(node.id, event.target.value)} /></>}{node.kind === "condition" && node.config && "operator" in node.config && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginTop: 8 }}><div><label className="field-label" style={{ display: "block" }}>Input path</label><input aria-label={`Step ${index + 1} condition path`} className="field-input" value={node.config.path} maxLength={200} onChange={(event) => updateCondition(node.id, "path", event.target.value)} /></div><div><label className="field-label" style={{ display: "block" }}>Operator</label><select aria-label={`Step ${index + 1} condition operator`} className="field-input" value={node.config.operator} onChange={(event) => updateCondition(node.id, "operator", event.target.value)}><option value="exists">Exists</option><option value="equals">Equals</option><option value="not_equals">Does not equal</option><option value="contains">Contains</option><option value="greater_than">Greater than</option><option value="less_than">Less than</option></select></div>{node.config.operator !== "exists" && <div><label className="field-label" style={{ display: "block" }}>Comparison value</label>{typeof node.config.value === "boolean" ? <select aria-label={`Step ${index + 1} condition value`} className="field-input" value={String(node.config.value)} onChange={(event) => updateCondition(node.id, "value", event.target.value)}><option value="true">True</option><option value="false">False</option></select> : <input aria-label={`Step ${index + 1} condition value`} className="field-input" type={node.config.operator === "greater_than" || node.config.operator === "less_than" || typeof node.config.value === "number" ? "number" : "text"} value={node.config.value == null ? "" : String(node.config.value)} onChange={(event) => updateCondition(node.id, "value", event.target.value)} />}</div>}</div>}{node.kind === "action" && !node.config && <div className="activity-meta" style={{ marginTop: 8 }}>This action has no live configuration yet. Connect a supported integration before activation.</div>}<div className="activity-meta" style={{ marginTop: 4 }}>{node.kind}</div></div></div>)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 18 }}>
        <div><div className="panel-subtitle">Assumptions</div>{plan.assumptions.length ? <ul>{plan.assumptions.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="activity-meta">No assumptions supplied.</p>}</div>
        <div><div className="panel-subtitle">Required integrations</div>{plan.requiredIntegrations.length ? <ul>{plan.requiredIntegrations.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="activity-meta">No external integrations declared.</p>}</div>
        <div><div className="panel-subtitle">Required permissions</div>{plan.requiredPermissions.length ? <ul>{plan.requiredPermissions.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="activity-meta">No additional permissions declared.</p>}</div>
        <div><div className="panel-subtitle">External side effects</div>{plan.sideEffects.length ? <ul>{plan.sideEffects.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="activity-meta">No side effects declared.</p>}</div>
      </div>
      {plan.executionReadiness === "setup_required" && <div className="demo-notice" role="status" style={{ marginTop: 16 }}>Setup required. {plan.missingIntegrations.length > 0 && <>Missing integrations: {plan.missingIntegrations.join(", ")}. </>}{plan.setupRequiredActions.length > 0 && <>Actions needing configuration: {plan.setupRequiredActions.join(", ")}.</>}</div>}
      {plan.executionReadiness === "review_required" && <div className="demo-notice" role="status" style={{ marginTop: 16 }}>The plan has no known missing integrations or unconfigured actions. Review it carefully before saving or activating.</div>}
      {usage && <div className="activity-meta" style={{ marginTop: 14 }}>Workspace AI usage this month: {usage.requestsUsed}/{usage.monthlyRequestLimit} requests · {usage.tokensUsed.toLocaleString()}/{usage.monthlyTokenLimit.toLocaleString()} tokens. This request: {usage.tokensThisRequest.toLocaleString()} tokens via {usage.provider}/{usage.model}.</div>}
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 20 }}><button className="btn btn-quiet" onClick={() => void simulatePlan()} disabled={testing}><FlaskConical size={14}/>{testing ? "Simulating…" : "Run safe simulation"}</button><button className="btn btn-primary" onClick={() => void saveDraft()} disabled={saving || plan.name.trim().length < 2}>{saving ? "Saving…" : "Save as draft"}<ArrowRight size={13}/></button><button className="btn btn-quiet" onClick={() => { setPlan(null); setDryRun(null); }}>Discard</button></div>
      {dryRun && <div className="demo-notice" role="status" style={{ marginTop: 16 }}><strong>Simulation only · no external side effects</strong><div>{dryRun.note}</div><ol>{dryRun.selectedPath.map((step) => <li key={step.nodeId}>{step.title} — {step.outcome}</li>)}</ol></div>}
    </div></section>}
  </div></AppShell>;
}
