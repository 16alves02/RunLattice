"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Circle, GitBranch, Plus, Save, Settings2, Sparkles, Webhook, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ManualRunInput } from "@/components/manual-run-input";
import { demoDefinition } from "@/lib/demo-data";
import type { ConditionConfig, DiscordActionConfig, HttpActionConfig, TriggerConfig, WorkflowDefinition, WorkflowNode } from "@/lib/types";

type WorkflowBuilderProps = { workflowId?: string };
type IntegrationConnection = { id: string; provider: string; name: string };

export function WorkflowBuilder({ workflowId }: WorkflowBuilderProps) {
  const router = useRouter();
  const [name, setName] = useState("Untitled workflow");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE" | "PAUSED">("DRAFT");
  const [nodes, setNodes] = useState<WorkflowNode[]>(workflowId ? [] : demoDefinition.nodes);
  const [edges, setEdges] = useState<WorkflowDefinition["edges"]>(workflowId ? [] : demoDefinition.edges);
  const [selected, setSelected] = useState(workflowId ? "" : demoDefinition.nodes[1].id);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(Boolean(workflowId));
  const [saving, setSaving] = useState(false);
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [webhookSecret, setWebhookSecret] = useState("");
  const selectedNode = useMemo(() => nodes.find((node) => node.id === selected), [nodes, selected]);
  const selectedActionConfig = selectedNode?.config && "integrationId" in selectedNode.config && selectedNode.config.integrationId === "discord" ? selectedNode.config : undefined;
  const selectedHttpActionConfig = selectedNode?.config && "integrationId" in selectedNode.config && selectedNode.config.integrationId === "http" ? selectedNode.config : undefined;
  const selectedConditionConfig = selectedNode?.config && "operator" in selectedNode.config ? selectedNode.config : undefined;
  const selectedTriggerConfig = selectedNode?.config && "triggerType" in selectedNode.config ? selectedNode.config : undefined;
  const hasCondition = nodes.some((node) => node.kind === "condition");

  useEffect(() => {
    const controller = new AbortController();
    async function loadConnections() {
      try {
        const response = await fetch("/api/integrations", { signal: controller.signal });
        const result = await response.json().catch(() => ({}));
        if (response.ok && Array.isArray(result.connections)) setConnections(result.connections);
      } catch {
        if (!controller.signal.aborted) setNotice("Integration connections could not be loaded.");
      }
    }
    void loadConnections();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!workflowId) return;
    const controller = new AbortController();
    const id = workflowId;

    async function loadWorkflow() {
      try {
        const response = await fetch(`/api/workflows/${encodeURIComponent(id)}`, { signal: controller.signal });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Workflow could not be loaded.");
        const workflow = result.data;
        if (!workflow || !workflow.definition || !Array.isArray(workflow.definition.nodes) || !Array.isArray(workflow.definition.edges)) {
          throw new Error("The saved workflow definition is invalid.");
        }
        setName(workflow.name);
        setDescription(workflow.description ?? "");
        setStatus(workflow.status);
        setNodes(workflow.definition.nodes);
        setEdges(workflow.definition.edges);
        setSelected(workflow.definition.nodes[0]?.id ?? "");
      } catch (error) {
        if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "Workflow could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadWorkflow();
    return () => controller.abort();
  }, [workflowId]);

  function addNode(kind: WorkflowNode["kind"]) {
    const timestamp = Date.now();
    const node: WorkflowNode = {
      id: `${kind}-${timestamp}`,
      kind,
      title: kind === "trigger" ? "New trigger" : kind === "condition" ? "Check input" : "New action",
      detail: kind === "trigger" ? "Trigger · Manual" : kind === "condition" ? "Condition · True / false" : "Action · Configure step",
      ...(kind === "condition" ? { config: { path: "customer.score", operator: "greater_than", value: 0 } as ConditionConfig } : {}),
      x: 70 + (nodes.length % 3) * 280,
      y: 90 + Math.floor(nodes.length / 3) * 140,
    };
    const previousNode = nodes[nodes.length - 1];
    if (kind === "condition") {
      const trueAction: WorkflowNode = {
        id: `action-true-${timestamp}`, kind: "action", title: "If true", detail: "Action · True branch",
        x: node.x + 300, y: node.y - 75,
      };
      const falseAction: WorkflowNode = {
        id: `action-false-${timestamp}`, kind: "action", title: "If false", detail: "Action · False branch",
        x: node.x + 300, y: node.y + 105,
      };
      setNodes((current) => [...current, node, trueAction, falseAction]);
      setEdges((current) => [
        ...current,
        ...(previousNode ? [{ id: `edge-${timestamp}`, from: previousNode.id, to: node.id }] : []),
        { id: `edge-true-${timestamp}`, from: node.id, to: trueAction.id, branch: "true" as const },
        { id: `edge-false-${timestamp}`, from: node.id, to: falseAction.id, branch: "false" as const },
      ]);
    } else {
      setNodes((current) => [...current, node]);
      if (previousNode && kind !== "trigger") setEdges((current) => [...current, { id: `edge-${timestamp}`, from: previousNode.id, to: node.id }]);
    }
    setSelected(node.id);
    setNotice(kind === "condition"
      ? "Condition added with true and false action branches. Configure each branch before activation."
      : "Node added. Save your changes to update the workflow.");
  }

  function updateSelected(patch: Partial<WorkflowNode>) {
    setNodes((current) => current.map((node) => node.id === selected ? { ...node, ...patch } : node));
  }

  function updateSelectedActionConfig(patch: Partial<DiscordActionConfig>) {
    if (!selectedNode || selectedNode.kind !== "action") return;
    const existingConfig = selectedNode.config && "integrationId" in selectedNode.config
      && selectedNode.config.integrationId === "discord" ? selectedNode.config : undefined;
    const config: DiscordActionConfig = {
      integrationId: "discord",
      actionId: "send_message",
      connectionId: existingConfig?.connectionId ?? "",
      message: existingConfig?.message ?? "",
      ...existingConfig,
      ...patch,
    };
    updateSelected({ config });
  }

  function updateSelectedHttpActionConfig(patch: Partial<HttpActionConfig>) {
    if (!selectedNode || selectedNode.kind !== "action") return;
    const existingConfig = selectedNode.config && "integrationId" in selectedNode.config
      && selectedNode.config.integrationId === "http" ? selectedNode.config : undefined;
    const config: HttpActionConfig = {
      integrationId: "http",
      actionId: "request",
      connectionId: existingConfig?.connectionId ?? "",
      method: existingConfig?.method ?? "POST",
      url: existingConfig?.url ?? "",
      body: existingConfig?.body ?? "",
      ...existingConfig,
      ...patch,
    };
    updateSelected({ config });
  }

  function updateSelectedConditionConfig(patch: Partial<ConditionConfig>) {
    if (!selectedNode || selectedNode.kind !== "condition") return;
    const config: ConditionConfig = {
      path: "customer.score",
      operator: "greater_than",
      value: 0,
      ...(selectedNode.config && "operator" in selectedNode.config ? selectedNode.config : {}),
      ...patch,
    };
    updateSelected({ config });
  }

  function updateSelectedTriggerConfig(patch: Partial<TriggerConfig>) {
    if (!selectedNode || selectedNode.kind !== "trigger") return;
    const config: TriggerConfig = {
      triggerType: "MANUAL",
      timezone: "UTC",
      ...(selectedNode.config && "triggerType" in selectedNode.config ? selectedNode.config : {}),
      ...patch,
    };
    if (config.triggerType !== "SCHEDULE") {
      delete config.cronExpression;
      delete config.timezone;
    }
    updateSelected({ config, detail: `Trigger · ${config.triggerType}` });
    setWebhookSecret("");
  }

  async function generateWebhookSecret() {
    if (!workflowId) {
      setNotice("Save the workflow before generating its webhook secret.");
      return;
    }
    try {
      const response = await fetch(`/api/workflows/${encodeURIComponent(workflowId)}/webhook-secret`, { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Webhook secret could not be generated.");
      setWebhookSecret(result.data.secret);
      setNotice("Signing secret generated. Copy it now; it will not be shown again.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Webhook secret could not be generated.");
    }
  }

  async function saveWorkflow() {
    if (name.trim().length < 2) {
      setNotice("The workflow name must contain at least two characters.");
      return;
    }
    if (nodes.length === 0) {
      setNotice("Add at least one node before saving.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        definition: { nodes, edges: edges.filter((edge) => nodes.some((node) => node.id === edge.from) && nodes.some((node) => node.id === edge.to)) },
      };
      const response = await fetch(workflowId ? `/api/workflows/${encodeURIComponent(workflowId)}` : "/api/workflows", {
        method: workflowId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "The workflow could not be saved.");
      setNotice(workflowId ? "Workflow changes saved." : "Workflow created and saved to the database.");
      if (!workflowId && result.data?.id) router.replace(`/workflows/new?workflow=${encodeURIComponent(result.data.id)}`);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not reach the RunLattice API.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(nextStatus: "DRAFT" | "ACTIVE" | "PAUSED") {
    if (!workflowId) {
      setNotice("Save this workflow before changing its status.");
      return;
    }
    try {
      const response = await fetch(`/api/workflows/${encodeURIComponent(workflowId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Status could not be updated.");
      setStatus(nextStatus);
      setNotice(`Workflow status changed to ${nextStatus.toLowerCase()}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Status could not be updated.");
    }
  }


  function removeSelected() {
    setNodes((current) => current.filter((node) => node.id !== selected));
    setEdges((current) => current.filter((edge) => edge.from !== selected && edge.to !== selected));
    setSelected(nodes.find((node) => node.id !== selected)?.id ?? "");
    setNotice("Node removed from the unsaved changes.");
  }

  return <AppShell active="Builder"><div className="page">
    <div className="page-heading"><div><Link href="/workflows" style={{ color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, marginBottom: 14 }}><ArrowLeft size={13}/> All workflows</Link><h1>{workflowId ? "Edit workflow" : "Workflow builder"}</h1><p className="subtitle">Build and maintain workflow definitions in your workspace.</p></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{workflowId && <><button className="btn btn-quiet" onClick={() => void updateStatus(status === "ACTIVE" ? "PAUSED" : "ACTIVE")}>{status === "ACTIVE" ? "Pause" : "Activate"}</button></>}<button className="btn btn-primary" onClick={() => void saveWorkflow()} disabled={saving || loading}><Save size={14}/>{saving ? "Saving…" : "Save changes"}</button></div></div>
    {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification" style={{ float: "right", color: "inherit", background: "none", border: 0 }}><X size={13}/></button></div>}
    {workflowId && !loading && <ManualRunInput workflowId={workflowId} disabled={status !== "ACTIVE"} />}
    {loading ? <div className="panel" style={{ padding: 24 }}>Loading workflow…</div> : <><div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}><span className="workflow-icon"><GitBranch size={16}/></span><input className="field-input" aria-label="Workflow name" value={name} onChange={(event) => setName(event.target.value)} style={{ maxWidth: 300, fontWeight: 800 }}/><input className="field-input" aria-label="Workflow description" placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} style={{ maxWidth: 300 }}/><span className={`status status-${status.toLowerCase()}`}>{status.toLowerCase()}</span></div>
    <div className="workflow-layout"><section className="canvas" aria-label="Workflow canvas"><div className="canvas-inner">
      {edges.map((edge) => { const from = nodes.find((node) => node.id === edge.from); const to = nodes.find((node) => node.id === edge.to); if (!from || !to) return null; const x1 = from.x + 190; const y1 = from.y + 41; const x2 = to.x; const y2 = to.y + 41; const dx = x2 - x1; const dy = y2 - y1; const length = Math.sqrt(dx * dx + dy * dy); const angle = Math.atan2(dy, dx) * 180 / Math.PI; return <div key={edge.id} className="edge" style={{ left: x1, top: y1, width: length, transform: `rotate(${angle}deg)` }}>{edge.branch ? <span className="edge-label">{edge.branch.toUpperCase()}</span> : null}</div>; })}
      {nodes.map((node) => <button key={node.id} className={`workflow-node ${selected === node.id ? "selected" : ""}`} style={{ left: node.x, top: node.y }} onClick={() => setSelected(node.id)} aria-pressed={selected === node.id}><span className="node-top"><span className="node-symbol">{node.kind === "trigger" ? <Webhook size={14}/> : node.kind === "condition" ? <Circle size={14}/> : <Sparkles size={14}/>}</span>{node.title}</span><span className="node-detail">{node.detail}</span></button>)}
      <div style={{ position: "absolute", left: 24, bottom: 20, color: "#707780", fontSize: 10 }}>Saved workflow canvas · Select a node to edit</div>
    </div></section>
    <aside className="panel"><div className="panel-heading"><div><div className="panel-title">Node settings</div><div className="panel-subtitle">Configure the selected step</div></div><Settings2 size={15} color="var(--muted)"/></div><div className="editor-panel">{selectedNode ? <><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="node-symbol">{selectedNode.kind === "trigger" ? <Webhook size={14}/> : selectedNode.kind === "condition" ? <Circle size={14}/> : <Sparkles size={14}/>}</span><div><div style={{ fontSize: 12, fontWeight: 800 }}>{selectedNode.kind[0].toUpperCase() + selectedNode.kind.slice(1)}</div><div style={{ color: "var(--muted)", fontSize: 10, marginTop: 3 }}>ID: {selectedNode.id.slice(0, 16)}</div></div></div><label className="field-label" htmlFor="node-title">Step name</label><input id="node-title" className="field-input" value={selectedNode.title} onChange={(event) => updateSelected({ title: event.target.value })}/><label className="field-label" htmlFor="node-detail">Description</label><input id="node-detail" className="field-input" value={selectedNode.detail} onChange={(event) => updateSelected({ detail: event.target.value })}/>{selectedNode.kind === "trigger" && <><label className="field-label" htmlFor="trigger-type">Trigger type</label><select id="trigger-type" className="field-input" value={selectedTriggerConfig?.triggerType ?? "MANUAL"} onChange={(event) => updateSelectedTriggerConfig({ triggerType: event.target.value as TriggerConfig["triggerType"], ...(event.target.value === "SCHEDULE" ? { cronExpression: selectedTriggerConfig?.cronExpression ?? "0 9 * * 1-5", timezone: selectedTriggerConfig?.timezone ?? "Europe/Lisbon" } : {}) })}><option value="MANUAL">Manual run</option><option value="WEBHOOK">Signed webhook</option><option value="SCHEDULE">Scheduled (cron)</option></select>{selectedTriggerConfig?.triggerType === "SCHEDULE" && <><label className="field-label" htmlFor="schedule-cron">Cron expression (5 fields)</label><input id="schedule-cron" className="field-input" value={selectedTriggerConfig.cronExpression ?? ""} onChange={(event) => updateSelectedTriggerConfig({ cronExpression: event.target.value })} placeholder="0 9 * * 1-5"/><label className="field-label" htmlFor="schedule-timezone">Timezone (IANA)</label><input id="schedule-timezone" className="field-input" value={selectedTriggerConfig.timezone ?? "UTC"} onChange={(event) => updateSelectedTriggerConfig({ timezone: event.target.value })} placeholder="Europe/Lisbon"/><div className="editor-help">The worker schedules this workflow using the selected timezone. The worker service must remain online.</div></>}{selectedTriggerConfig?.triggerType === "WEBHOOK" && <><div className="editor-help">Only requests with a valid HMAC-SHA256 signature and a timestamp within five minutes are accepted.</div><button className="btn" type="button" style={{ width: "100%" }} onClick={() => void generateWebhookSecret()} disabled={!workflowId}>Generate / rotate signing secret</button>{webhookSecret && <><label className="field-label" htmlFor="webhook-secret">Signing secret — copy now</label><textarea id="webhook-secret" className="field-input" rows={3} readOnly value={webhookSecret}/><button className="btn" type="button" onClick={() => void navigator.clipboard.writeText(webhookSecret)}>Copy secret</button></>}</>}</>}{selectedNode.kind === "condition" && selectedConditionConfig && <><label className="field-label" htmlFor="condition-path">Input field path</label><input id="condition-path" className="field-input" value={selectedConditionConfig.path} onChange={(event) => updateSelectedConditionConfig({ path: event.target.value })} placeholder="customer.score"/><label className="field-label" htmlFor="condition-operator">Comparison</label><select id="condition-operator" className="field-input" value={selectedConditionConfig.operator} onChange={(event) => updateSelectedConditionConfig({ operator: event.target.value as ConditionConfig["operator"], ...(event.target.value === "exists" ? { value: undefined } : {}) })}><option value="equals">Equals</option><option value="not_equals">Does not equal</option><option value="contains">Contains</option><option value="greater_than">Greater than</option><option value="less_than">Less than</option><option value="exists">Exists</option></select>{selectedConditionConfig.operator !== "exists" && <><label className="field-label" htmlFor="condition-value">Compare value</label><input id="condition-value" className="field-input" value={String(selectedConditionConfig.value ?? "")} onChange={(event) => updateSelectedConditionConfig({ value: ["greater_than", "less_than"].includes(selectedConditionConfig.operator) ? Number(event.target.value) : event.target.value })} placeholder="Value"/></>}<div className="editor-help">Only the matching true or false branch executes. Conditions read the manual run input and do not execute custom code.</div></>}{selectedNode.kind === "action" && <>
          <label className="field-label" htmlFor="action-provider">Action type</label>
          <select id="action-provider" className="field-input"
            value={selectedHttpActionConfig ? "http" : "discord"}
            onChange={(event) => updateSelected({ config: event.target.value === "http"
              ? { integrationId: "http", actionId: "request", method: "POST", url: "", connectionId: "", body: "" }
              : { integrationId: "discord", actionId: "send_message", connectionId: "", message: "" } })}>
            <option value="discord">Discord message</option>
            <option value="http">HTTP / REST API request</option>
          </select>
          {selectedHttpActionConfig ? <>
            <label className="field-label" htmlFor="http-connection">API connection</label>
            <select id="http-connection" className="field-input" value={selectedHttpActionConfig.connectionId ?? ""}
              onChange={(event) => updateSelectedHttpActionConfig({ connectionId: event.target.value })}>
              <option value="">Choose a connected API key</option>
              {connections.filter((connection) => connection.provider === "http").map((connection) => <option key={connection.id} value={connection.id}>{connection.name}</option>)}
            </select>
            <label className="field-label" htmlFor="http-method">HTTP method</label>
            <select id="http-method" className="field-input" value={selectedHttpActionConfig.method}
              onChange={(event) => updateSelectedHttpActionConfig({ method: event.target.value as HttpActionConfig["method"] })}>
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
            <label className="field-label" htmlFor="http-url">HTTPS destination URL</label>
            <input id="http-url" className="field-input" type="url" value={selectedHttpActionConfig.url}
              onChange={(event) => updateSelectedHttpActionConfig({ url: event.target.value })} placeholder="https://api.example.com/v1/items"/>
            <label className="field-label" htmlFor="http-body">JSON request body (optional)</label>
            <textarea id="http-body" className="field-input" rows={5} maxLength={65536}
              value={selectedHttpActionConfig.body ?? ""} onChange={(event) => updateSelectedHttpActionConfig({ body: event.target.value })}
              placeholder={'{"event":"{{event.name}}"}'} />
            <div className="editor-help">HTTPS only. Private/local destinations, redirects, oversized payloads and requests taking over 10 seconds are blocked. Dynamic values use the workflow input template syntax.</div>
            {connections.filter((connection) => connection.provider === "http").length === 0 && <Link href="/integrations" className="editor-help">Create an HTTP API key connection in Integrations first.</Link>}
          </> : <>
            <label className="field-label" htmlFor="action-connection">Discord connection</label>
            <select id="action-connection" className="field-input" value={selectedActionConfig?.connectionId ?? ""}
              onChange={(event) => updateSelectedActionConfig({ connectionId: event.target.value })}>
              <option value="">Choose a connected Discord webhook</option>
              {connections.filter((connection) => connection.provider === "discord").map((connection) => <option key={connection.id} value={connection.id}>{connection.name}</option>)}
            </select>
            <label className="field-label" htmlFor="action-message">Message</label>
            <textarea id="action-message" className="field-input" rows={4} maxLength={2000}
              value={selectedActionConfig?.message ?? ""} onChange={(event) => updateSelectedActionConfig({ message: event.target.value })}
              placeholder="Write the message to send to Discord…"/>
            <div className="editor-help">This action sends a real Discord message when the workflow runs. Keep the message under 2,000 characters.</div>
            {connections.filter((connection) => connection.provider === "discord").length === 0 && <Link href="/integrations" className="editor-help">Connect a Discord webhook in Integrations first.</Link>}
          </>}
        </>}<div className="editor-help">Changes are stored when you save the workflow.</div><button className="btn" style={{ width: "100%", marginTop: 17 }} onClick={removeSelected}><X size={13}/> Remove node</button></> : <div className="empty-state">Select a node on the canvas to edit it.</div>}</div></aside></div>
    <section className="panel" style={{ marginTop: 16 }}><div className="panel-heading"><div><div className="panel-title">Add a step</div><div className="panel-subtitle">Choose a node type to extend this workflow</div></div><span className="tag">{nodes.length} nodes</span></div><div style={{ padding: 14, display: "flex", gap: 10, flexWrap: "wrap" }}><button className="btn" onClick={() => addNode("trigger")}><Plus size={13}/> Trigger</button><button className="btn" onClick={() => addNode("condition")} disabled={hasCondition}><Plus size={13}/> {hasCondition ? "Condition added" : "Condition"}</button><button className="btn" onClick={() => addNode("action")}><Plus size={13}/> Action</button></div></section></>}
  </div></AppShell>;
}
