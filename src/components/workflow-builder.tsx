"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Circle, GitBranch, Play, Plus, Save, Settings2, Sparkles, Webhook, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { demoDefinition } from "@/lib/demo-data";
import type { WorkflowDefinition, WorkflowNode } from "@/lib/types";

type WorkflowBuilderProps = { workflowId?: string };

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
  const selectedNode = useMemo(() => nodes.find((node) => node.id === selected), [nodes, selected]);

  useEffect(() => {
    if (!workflowId) return;
    const controller = new AbortController();

    async function loadWorkflow() {
      try {
        const response = await fetch(`/api/workflows/${encodeURIComponent(workflowId)}`, { signal: controller.signal });
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
    const node: WorkflowNode = {
      id: `${kind}-${Date.now()}`,
      kind,
      title: kind === "trigger" ? "New trigger" : kind === "condition" ? "New condition" : "New action",
      detail: kind === "trigger" ? "Trigger · Manual" : kind === "condition" ? "Condition · Configure rule" : "Action · Configure step",
      x: 70 + (nodes.length % 3) * 280,
      y: 90 + Math.floor(nodes.length / 3) * 140,
    };
    const previousNode = nodes[nodes.length - 1];
    setNodes((current) => [...current, node]);
    if (previousNode && kind !== "trigger") setEdges((current) => [...current, { id: `edge-${Date.now()}`, from: previousNode.id, to: node.id }]);
    setSelected(node.id);
    setNotice("Node added. Save your changes to update the workflow.");
  }

  function updateSelected(patch: Partial<WorkflowNode>) {
    setNodes((current) => current.map((node) => node.id === selected ? { ...node, ...patch } : node));
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

  async function runWorkflow() {
    if (!workflowId || status !== "ACTIVE") {
      setNotice("Save and activate this workflow before queueing a run.");
      return;
    }
    try {
      const response = await fetch(`/api/workflows/${encodeURIComponent(workflowId)}/runs`, { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "The workflow run could not be queued.");
      setNotice("Run queued. Open execution history to follow its status.");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The workflow run could not be queued.");
    }
  }

  function removeSelected() {
    setNodes((current) => current.filter((node) => node.id !== selected));
    setEdges((current) => current.filter((edge) => edge.from !== selected && edge.to !== selected));
    setSelected(nodes.find((node) => node.id !== selected)?.id ?? "");
    setNotice("Node removed from the unsaved changes.");
  }

  return <AppShell active="Builder"><div className="page">
    <div className="page-heading"><div><Link href="/workflows" style={{ color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, marginBottom: 14 }}><ArrowLeft size={13}/> All workflows</Link><h1>{workflowId ? "Edit workflow" : "Workflow builder"}</h1><p className="subtitle">Build and maintain workflow definitions in your workspace.</p></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{workflowId && <><button className="btn btn-quiet" onClick={() => void runWorkflow()}><Play size={13}/> Queue run</button><button className="btn btn-quiet" onClick={() => void updateStatus(status === "ACTIVE" ? "PAUSED" : "ACTIVE")}>{status === "ACTIVE" ? "Pause" : "Activate"}</button></>}<button className="btn btn-primary" onClick={() => void saveWorkflow()} disabled={saving || loading}><Save size={14}/>{saving ? "Saving…" : "Save changes"}</button></div></div>
    {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification" style={{ float: "right", color: "inherit", background: "none", border: 0 }}><X size={13}/></button></div>}
    {loading ? <div className="panel" style={{ padding: 24 }}>Loading workflow…</div> : <><div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}><span className="workflow-icon"><GitBranch size={16}/></span><input className="field-input" aria-label="Workflow name" value={name} onChange={(event) => setName(event.target.value)} style={{ maxWidth: 300, fontWeight: 800 }}/><input className="field-input" aria-label="Workflow description" placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} style={{ maxWidth: 300 }}/><span className={`status status-${status.toLowerCase()}`}>{status.toLowerCase()}</span></div>
    <div className="workflow-layout"><section className="canvas" aria-label="Workflow canvas"><div className="canvas-inner">
      {edges.map((edge) => { const from = nodes.find((node) => node.id === edge.from); const to = nodes.find((node) => node.id === edge.to); if (!from || !to) return null; const x1 = from.x + 190; const y1 = from.y + 41; const x2 = to.x; const y2 = to.y + 41; const dx = x2 - x1; const dy = y2 - y1; const length = Math.sqrt(dx * dx + dy * dy); const angle = Math.atan2(dy, dx) * 180 / Math.PI; return <div key={edge.id} className="edge" style={{ left: x1, top: y1, width: length, transform: `rotate(${angle}deg)` }}/>; })}
      {nodes.map((node) => <button key={node.id} className={`workflow-node ${selected === node.id ? "selected" : ""}`} style={{ left: node.x, top: node.y }} onClick={() => setSelected(node.id)} aria-pressed={selected === node.id}><span className="node-top"><span className="node-symbol">{node.kind === "trigger" ? <Webhook size={14}/> : node.kind === "condition" ? <Circle size={14}/> : <Sparkles size={14}/>}</span>{node.title}</span><span className="node-detail">{node.detail}</span></button>)}
      <div style={{ position: "absolute", left: 24, bottom: 20, color: "#707780", fontSize: 10 }}>Saved workflow canvas · Select a node to edit</div>
    </div></section>
    <aside className="panel"><div className="panel-heading"><div><div className="panel-title">Node settings</div><div className="panel-subtitle">Configure the selected step</div></div><Settings2 size={15} color="var(--muted)"/></div><div className="editor-panel">{selectedNode ? <><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="node-symbol">{selectedNode.kind === "trigger" ? <Webhook size={14}/> : selectedNode.kind === "condition" ? <Circle size={14}/> : <Sparkles size={14}/>}</span><div><div style={{ fontSize: 12, fontWeight: 800 }}>{selectedNode.kind[0].toUpperCase() + selectedNode.kind.slice(1)}</div><div style={{ color: "var(--muted)", fontSize: 10, marginTop: 3 }}>ID: {selectedNode.id.slice(0, 16)}</div></div></div><label className="field-label" htmlFor="node-title">Step name</label><input id="node-title" className="field-input" value={selectedNode.title} onChange={(event) => updateSelected({ title: event.target.value })}/><label className="field-label" htmlFor="node-detail">Description</label><input id="node-detail" className="field-input" value={selectedNode.detail} onChange={(event) => updateSelected({ detail: event.target.value })}/><div className="editor-help">Changes are stored when you save the workflow. External integrations are not configured in this version.</div><button className="btn" style={{ width: "100%", marginTop: 17 }} onClick={removeSelected}><X size={13}/> Remove node</button></> : <div className="empty-state">Select a node on the canvas to edit it.</div>}</div></aside></div>
    <section className="panel" style={{ marginTop: 16 }}><div className="panel-heading"><div><div className="panel-title">Add a step</div><div className="panel-subtitle">Choose a node type to extend this workflow</div></div><span className="tag">{nodes.length} nodes</span></div><div style={{ padding: 14, display: "flex", gap: 10, flexWrap: "wrap" }}><button className="btn" onClick={() => addNode("trigger")}><Plus size={13}/> Trigger</button><button className="btn" onClick={() => addNode("condition")}><Plus size={13}/> Condition</button><button className="btn" onClick={() => addNode("action")}><Plus size={13}/> Action</button></div></section></>}
  </div></AppShell>;
}
