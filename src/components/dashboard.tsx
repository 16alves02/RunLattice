"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Clock3, Command, GitBranch, Play, Plus, Radio, Workflow, Zap } from "lucide-react";
import { demoWorkflows } from "@/lib/demo-data";
import { AppShell } from "@/components/app-shell";

const activityItems = [
  { title: "Lead capture pipeline", detail: "Run completed successfully", time: "2 min ago", color: "#83d3a1" },
  { title: "Weekly report", detail: "Scheduled run queued", time: "18 min ago", color: "#ffb86b" },
  { title: "Support triage", detail: "Workflow paused by user", time: "Yesterday", color: "#a0a7b0" },
];

export function Dashboard() {
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const workflows = useMemo(() => demoWorkflows.filter((workflow) => workflow.name.toLowerCase().includes(query.toLowerCase())), [query]);

  function runDemo(name: string) {
    setNotice(`Demo mode: “${name}” is ready to run. Connect PostgreSQL and Redis to enable real executions.`);
  }

  return <AppShell><div className="page">
    <div className="page-heading"><div><div style={{ color: "var(--accent)", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Your workspace</div><h1>Your automation workspace.</h1><p className="subtitle">A clear view of your automations, activity and what needs attention.</p></div><Link className="btn btn-primary" href="/workflows/new"><Plus size={15}/> Create workflow</Link></div>
    {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification" style={{ float: "right", color: "inherit", background: "none", border: 0 }}>×</button></div>}
    <div className="demo-notice" role="note">Demo mode: dashboard metrics, activity and workflow records below are illustrative examples, not live production data.</div><div className="stats-grid">
      <div className="stat-card"><div className="stat-label">Total workflows <Workflow size={15}/></div><div className="stat-value">12</div><div className="stat-foot"><span className="positive"><ArrowUpRight size={12} style={{ verticalAlign: "middle" }}/> 3</span> compared with last month</div></div>
      <div className="stat-card"><div className="stat-label">Successful runs <Zap size={15}/></div><div className="stat-value">1,643</div><div className="stat-foot"><span className="positive"><ArrowUpRight size={12} style={{ verticalAlign: "middle" }}/> 12.8%</span> success rate trend</div></div>
      <div className="stat-card"><div className="stat-label">Success rate <Activity size={15}/></div><div className="stat-value">98.6<span style={{ fontSize: 15, color: "var(--muted)" }}>%</span></div><div className="stat-foot"><span className="positive">Healthy</span> across active workflows</div></div>
      <div className="stat-card"><div className="stat-label">Time saved <Clock3 size={15}/></div><div className="stat-value">34.2<span style={{ fontSize: 15, color: "var(--muted)" }}>h</span></div><div className="stat-foot"><ArrowDownRight size={12}/> Estimated from demo activity</div></div>
    </div>
    <section className="panel"><div className="panel-heading"><div><div className="panel-title">Your workflows</div><div className="panel-subtitle">Manage and monitor your latest automations</div></div><div style={{ display: "flex", gap: 8, alignItems: "center" }}><input aria-label="Search workflows" className="field-input" placeholder="Search workflows..." value={query} onChange={(event) => setQuery(event.target.value)} style={{ width: 170, padding: "8px 10px" }}/><Link href="/workflows" className="btn btn-quiet">View all <ArrowRight size={13}/></Link></div></div>
      <div style={{ overflowX: "auto" }}><table className="workflow-table"><thead><tr><th>Workflow</th><th>Status</th><th>Trigger</th><th>Runs</th><th>Last updated</th><th aria-label="Actions"></th></tr></thead><tbody>{workflows.map((workflow) => <tr key={workflow.id}><td><div className="workflow-name"><span className="workflow-icon"><GitBranch size={16}/></span><span>{workflow.name}<span style={{ display: "block", color: "var(--muted)", fontWeight: 500, fontSize: 10, marginTop: 4 }}>{workflow.description}</span></span></div></td><td><span className={`status status-${workflow.status.toLowerCase()}`}>{workflow.status.toLowerCase()}</span></td><td><span className="trigger-label"><Radio size={13}/>{workflow.triggerType.toLowerCase()}</span></td><td>{workflow.runs.toLocaleString("en-GB")}</td><td>{new Date(workflow.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</td><td><button className="btn" aria-label={`Run ${workflow.name}`} onClick={() => runDemo(workflow.name)} style={{ padding: 7 }}><Play size={12}/></button></td></tr>)}{workflows.length === 0 && <tr><td colSpan={6}><div className="empty-state">No workflows match “{query}”.</div></td></tr>}</tbody></table></div>
    </section>
    <div className="bottom-grid"><section className="panel"><div className="panel-heading"><div><div className="panel-title">Recent activity</div><div className="panel-subtitle">The latest events across your workspace</div></div><Link href="/runs" className="btn btn-quiet">Execution history <ArrowRight size={13}/></Link></div><div className="activity-list">{activityItems.map((item) => <div className="activity-item" key={item.title}><span className="activity-dot" style={{ background: item.color }}/><div style={{ flex: 1 }}><div className="activity-title">{item.title}</div><div className="activity-meta">{item.detail}</div></div><div className="activity-meta" style={{ whiteSpace: "nowrap" }}>{item.time}</div></div>)}</div></section>
      <section className="panel"><div className="panel-heading"><div><div className="panel-title">Quick actions</div><div className="panel-subtitle">Keep your work moving</div></div></div><div className="quick-list"><Link href="/workflows/new" className="quick-action"><span className="quick-icon"><Plus size={16}/></span><span><span className="quick-title" style={{ display: "block" }}>Build a workflow</span><span className="quick-description" style={{ display: "block" }}>Start with a trigger and add steps</span></span><ArrowRight size={14} style={{ marginLeft: "auto", color: "var(--muted)" }}/></Link><Link href="/workflows" className="quick-action"><span className="quick-icon"><GitBranch size={16}/></span><span><span className="quick-title" style={{ display: "block" }}>Explore automations</span><span className="quick-description" style={{ display: "block" }}>Review existing workflow definitions</span></span><ArrowRight size={14} style={{ marginLeft: "auto", color: "var(--muted)" }}/></Link></div></section></div>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 15, color: "#646b74", fontSize: 10, marginTop: 24 }}><span>RunLattice · Portfolio build</span><span><Command size={11} style={{ verticalAlign: "middle", marginRight: 4 }}/>Demo data is clearly labelled; live execution requires backend services.</span></div>
  </div></AppShell>;
}
