"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Circle, GitBranch, Play, Plus, Save, Settings2, Sparkles, Webhook, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { demoDefinition } from "@/lib/demo-data";
import type { WorkflowNode } from "@/lib/types";

const initialNodes = demoDefinition.nodes;
const initialEdges = demoDefinition.edges;

export function WorkflowBuilder() {
  const [name, setName] = useState("Lead capture pipeline");
  const [nodes, setNodes] = useState<WorkflowNode[]>(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [selected, setSelected] = useState(initialNodes[1].id);
  const [notice, setNotice] = useState("");
  const selectedNode = useMemo(() => nodes.find((node) => node.id === selected), [nodes, selected]);

  function addNode(kind: WorkflowNode["kind"]) {
    const count = nodes.filter((node) => node.kind === kind).length + 1;
    const node: WorkflowNode = {
      id: `${kind}-${Date.now()}`, kind, title: kind === "trigger" ? "New trigger" : kind === "condition" ? "New condition" : "New action",
      detail: kind === "trigger" ? "Trigger · Manual" : kind === "condition" ? "Condition · Configure rule" : "Action · Configure step",
      x: 70 + (nodes.length % 3) * 280, y: 90 + Math.floor(nodes.length / 3) * 140 + (count - 1) * 10,
    };
    const previousNode = nodes[nodes.length - 1];
    setNodes((current) => [...current, node]);
    if (previousNode && kind !== "trigger") {
      setEdges((current) => [...current, { id: `edge-${Date.now()}`, from: previousNode.id, to: node.id }]);
    }
    setSelected(node.id); setNotice("Node added to the draft. Save the workflow when you are ready.");
  }

  function updateSelected(patch: Partial<WorkflowNode>) {
    setNodes((current) => current.map((node) => node.id === selected ? { ...node, ...patch } : node));
  }

  async function saveDraft() {
    const workflowName = name.trim();
    if (workflowName.length < 2) {
      setNotice("Give this workflow a name with at least two characters before saving.");
      return;
    }

    try {
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workflowName,
          description: "Created in the RunLattice workflow builder.",
          definition: { nodes, edges: edges.filter((edge) => nodes.some((node) => node.id === edge.from) && nodes.some((node) => node.id === edge.to)) },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(typeof result.error === "string" ? result.error : "The workflow could not be saved. Check the database configuration.");
        return;
      }
      setNotice(`Workflow “${workflowName}” saved to the database. ID: ${result.data.id}`);
    } catch {
      setNotice("Could not reach the RunLattice API. Start the app and check the database configuration, then try again.");
    }
  }

  return <AppShell active="Builder"><div className="page">
    <div className="page-heading"><div><Link href="/workflows" style={{ color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, marginBottom: 14 }}><ArrowLeft size={13}/> All workflows</Link><h1>Workflow builder</h1><p className="subtitle">Connect triggers, conditions and actions to map out an automation.</p></div><div style={{ display: "flex", gap: 8 }}><button className="btn btn-quiet" onClick={() => setNotice("Test mode is a preview in this version. Live execution requires the worker and Redis connection.")}><Play size={13}/> Test workflow</button><button className="btn btn-primary" onClick={saveDraft}><Save size={14}/> Save draft</button></div></div>
    {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification" style={{ float: "right", color: "inherit", background: "none", border: 0 }}><X size={13}/></button></div>}
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}><span className="workflow-icon"><GitBranch size={16}/></span><input className="field-input" aria-label="Workflow name" value={name} onChange={(event) => setName(event.target.value)} style={{ maxWidth: 350, fontWeight: 800 }}/><span className="status status-draft">Draft</span><span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 10 }}>Autosave off · Demo mode</span></div>
    <div className="workflow-layout"><section className="canvas" aria-label="Workflow canvas"><div className="canvas-inner">
      {edges.map((edge) => { const from = nodes.find((node) => node.id === edge.from); const to = nodes.find((node) => node.id === edge.to); if (!from || !to) return null; const x1 = from.x + 190; const y1 = from.y + 41; const x2 = to.x; const y2 = to.y + 41; const dx = x2 - x1; const dy = y2 - y1; const length = Math.sqrt(dx * dx + dy * dy); const angle = Math.atan2(dy, dx) * 180 / Math.PI; return <div key={edge.id} className="edge" style={{ left: x1, top: y1, width: length, transform: `rotate(${angle}deg)` }}/>; })}
      {nodes.map((node) => <button key={node.id} className={`workflow-node ${selected === node.id ? "selected" : ""}`} style={{ left: node.x, top: node.y }} onClick={() => setSelected(node.id)} aria-pressed={selected === node.id}><span className="node-top"><span className="node-symbol">{node.kind === "trigger" ? <Webhook size={14}/> : node.kind === "condition" ? <Circle size={14}/> : <Sparkles size={14}/>}</span>{node.title}</span><span className="node-detail">{node.detail}</span></button>)}
      <div style={{ position: "absolute", left: 24, bottom: 20, color: "#707780", fontSize: 10 }}>Canvas preview · Select a node to edit its details</div>
    </div></section>
    <aside className="panel"><div className="panel-heading"><div><div className="panel-title">Node settings</div><div className="panel-subtitle">Configure the selected step</div></div><Settings2 size={15} color="var(--muted)"/></div><div className="editor-panel">{selectedNode ? <><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="node-symbol">{selectedNode.kind === "trigger" ? <Webhook size={14}/> : selectedNode.kind === "condition" ? <Circle size={14}/> : <Sparkles size={14}/>}</span><div><div style={{ fontSize: 12, fontWeight: 800 }}>{selectedNode.kind[0].toUpperCase() + selectedNode.kind.slice(1)}</div><div style={{ color: "var(--muted)", fontSize: 10, marginTop: 3 }}>ID: {selectedNode.id.slice(0, 16)}</div></div></div><label className="field-label" htmlFor="node-title">Step name</label><input id="node-title" className="field-input" value={selectedNode.title} onChange={(event) => updateSelected({ title: event.target.value })}/><label className="field-label" htmlFor="node-detail">Description</label><input id="node-detail" className="field-input" value={selectedNode.detail} onChange={(event) => updateSelected({ detail: event.target.value })}/><div className="editor-help">Changes are local to this demo until a database connection is configured. Keep each step focused on one responsibility.</div><button className="btn" style={{ width: "100%", marginTop: 17 }} onClick={() => { setNodes((current) => current.filter((node) => node.id !== selected)); setEdges((current) => current.filter((edge) => edge.from !== selected && edge.to !== selected)); setSelected(nodes.find((node) => node.id !== selected)?.id ?? ""); setNotice("Node removed from the draft."); }}><X size={13}/> Remove node</button></> : <div className="empty-state">Select a node on the canvas to edit it.</div>}</div></aside></div>
    <section className="panel" style={{ marginTop: 16 }}><div className="panel-heading"><div><div className="panel-title">Add a step</div><div className="panel-subtitle">Choose a node type to extend the draft</div></div><span className="tag">{nodes.length} nodes</span></div><div style={{ padding: 14, display: "flex", gap: 10, flexWrap: "wrap" }}><button className="btn" onClick={() => addNode("trigger")}><Plus size={13}/> Trigger</button><button className="btn" onClick={() => addNode("condition")}><Plus size={13}/> Condition</button><button className="btn" onClick={() => addNode("action")}><Plus size={13}/> Action</button></div></section>
  </div></AppShell>;
}
