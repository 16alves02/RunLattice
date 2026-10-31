"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowRight, Clock3, Command, GitBranch, Play, Plus, Radio, Workflow, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import type { WorkflowSummary } from "@/lib/types";

const activityItems = [
  { title: "Lead capture pipeline", detail: "Example run completed successfully", time: "2 min ago", color: "#83d3a1" },
  { title: "Weekly report", detail: "Example scheduled run queued", time: "18 min ago", color: "#ffb86b" },
  { title: "Support triage", detail: "Example workflow paused", time: "Yesterday", color: "#a0a7b0" },
];

export function Dashboard() {
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadWorkflows() {
      try {
        const response = await fetch("/api/workflows", { signal: controller.signal });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(typeof result.error === "string" ? result.error : "Workflows could not be loaded.");
        }

        if (!Array.isArray(result.data)) {
          throw new Error("The workflow API returned an unexpected response.");
        }

        setWorkflows(result.data as WorkflowSummary[]);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : "Workflows could not be loaded.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadWorkflows();
    return () => controller.abort();
  }, []);

  const filteredWorkflows = useMemo(
    () => workflows.filter((workflow) => workflow.name.toLowerCase().includes(query.toLowerCase())),
    [workflows, query],
  );
  const activeCount = workflows.filter((workflow) => workflow.status === "ACTIVE").length;
  const totalRuns = workflows.reduce((total, workflow) => total + workflow.runs, 0);
  const inactiveCount = workflows.length - activeCount;

  function showRunNotice(name: string) {
    setNotice(`Live execution is not available from the dashboard yet. “${name}” has not been started.`);
  }

  return <AppShell><div className="page">
    <div className="page-heading"><div><div style={{ color: "var(--accent)", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Your workspace</div><h1>Your automation workspace.</h1><p className="subtitle">A clear view of your automations, activity and what needs attention.</p></div><Link className="btn btn-primary" href="/workflows/new"><Plus size={15}/> Create workflow</Link></div>
    {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification" style={{ float: "right", color: "inherit", background: "none", border: 0 }}>×</button></div>}
    {loadError && <div className="toast" role="alert">{loadError}</div>}
    <div className="stats-grid">
      <div className="stat-card"><div className="stat-label">Total workflows <Workflow size={15}/></div><div className="stat-value">{loading ? "…" : workflows.length}</div><div className="stat-foot">Saved in this workspace</div></div>
      <div className="stat-card"><div className="stat-label">Active workflows <Zap size={15}/></div><div className="stat-value">{loading ? "…" : activeCount}</div><div className="stat-foot"><span className="positive">Active</span> workflow definitions</div></div>
      <div className="stat-card"><div className="stat-label">Execution records <Activity size={15}/></div><div className="stat-value">{loading ? "…" : totalRuns.toLocaleString("en-GB")}</div><div className="stat-foot">Runs recorded in the database</div></div>
      <div className="stat-card"><div className="stat-label">Draft or paused <Clock3 size={15}/></div><div className="stat-value">{loading ? "…" : inactiveCount}</div><div className="stat-foot"><ArrowDownRight size={12}/> Not currently active</div></div>
    </div>
    <section className="panel"><div className="panel-heading"><div><div className="panel-title">Your workflows</div><div className="panel-subtitle">Saved workflow definitions from the database</div></div><div style={{ display: "flex", gap: 8, alignItems: "center" }}><input aria-label="Search workflows" className="field-input" placeholder="Search workflows..." value={query} onChange={(event) => setQuery(event.target.value)} style={{ width: 170, padding: "8px 10px" }}/><Link href="/workflows" className="btn btn-quiet">View all <ArrowRight size={13}/></Link></div></div>
      <div style={{ overflowX: "auto" }}><table className="workflow-table"><thead><tr><th>Workflow</th><th>Status</th><th>Trigger</th><th>Runs</th><th>Last updated</th><th aria-label="Actions"></th></tr></thead><tbody>
        {filteredWorkflows.map((workflow) => <tr key={workflow.id}><td><div className="workflow-name"><span className="workflow-icon"><GitBranch size={16}/></span><span>{workflow.name}<span style={{ display: "block", color: "var(--muted)", fontWeight: 500, fontSize: 10, marginTop: 4 }}>{workflow.description}</span></span></div></td><td><span className={`status status-${workflow.status.toLowerCase()}`}>{workflow.status.toLowerCase()}</span></td><td><span className="trigger-label"><Radio size={13}/>{workflow.triggerType.toLowerCase()}</span></td><td>{workflow.runs.toLocaleString("en-GB")}</td><td>{new Date(workflow.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</td><td><button className="btn" aria-label={`Run ${workflow.name}`} onClick={() => showRunNotice(workflow.name)} style={{ padding: 7 }}><Play size={12}/></button></td></tr>)}
        {!loading && filteredWorkflows.length === 0 && <tr><td colSpan={6}><div className="empty-state">{loadError ? "Workflow data is unavailable." : query ? `No workflows match “${query}”.` : "No workflows yet. Create your first workflow to get started."}</div></td></tr>}
        {loading && <tr><td colSpan={6}><div className="empty-state">Loading workflows…</div></td></tr>}
      </tbody></table></div>
    </section>
    <div className="bottom-grid"><section className="panel"><div className="panel-heading"><div><div className="panel-title">Recent activity</div><div className="panel-subtitle">Illustrative examples, not live execution events</div></div><Link href="/runs" className="btn btn-quiet">Execution history <ArrowRight size={13}/></Link></div><div className="activity-list">{activityItems.map((item) => <div className="activity-item" key={item.title}><span className="activity-dot" style={{ background: item.color }}/><div style={{ flex: 1 }}><div className="activity-title">{item.title}</div><div className="activity-meta">{item.detail}</div></div><div className="activity-meta" style={{ whiteSpace: "nowrap" }}>{item.time}</div></div>)}</div></section>
      <section className="panel"><div className="panel-heading"><div><div className="panel-title">Quick actions</div><div className="panel-subtitle">Keep your work moving</div></div></div><div className="quick-list"><Link href="/workflows/new" className="quick-action"><span className="quick-icon"><Plus size={16}/></span><span><span className="quick-title" style={{ display: "block" }}>Build a workflow</span><span className="quick-description" style={{ display: "block" }}>Start with a trigger and add steps</span></span><ArrowRight size={14} style={{ marginLeft: "auto", color: "var(--muted)" }}/></Link><Link href="/workflows" className="quick-action"><span className="quick-icon"><GitBranch size={16}/></span><span><span className="quick-title" style={{ display: "block" }}>Explore automations</span><span className="quick-description" style={{ display: "block" }}>Review saved workflow definitions</span></span><ArrowRight size={14} style={{ marginLeft: "auto", color: "var(--muted)" }}/></Link></div></section></div>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 15, color: "#646b74", fontSize: 10, marginTop: 24 }}><span>RunLattice · Portfolio build</span><span><Command size={11} style={{ verticalAlign: "middle", marginRight: 4 }}/>Workflow records are loaded from PostgreSQL.</span></div>
  </div></AppShell>;
}
