import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, GitBranch, Plus, Workflow } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { demoWorkflows } from "@/lib/demo-data";

export const metadata: Metadata = {
  title: "Workflows",
  description: "Review example workflow definitions and open the RunLattice visual builder.",
};

export default function WorkflowsPage() {
  return <AppShell active="Workflows"><div className="page"><div className="page-heading"><div><h1>Workflows</h1><p className="subtitle">Review the automations in your workspace and open a draft in the builder.</p></div><Link href="/workflows/new" className="btn btn-primary"><Plus size={14}/> New workflow</Link></div><section className="panel"><div className="panel-heading"><div><div className="panel-title">All workflows</div><div className="panel-subtitle">Sample workspace data · not connected to a live database</div></div><span className="tag">{demoWorkflows.length} examples</span></div><div style={{ overflowX: "auto" }}><table className="workflow-table"><thead><tr><th>Name</th><th>Status</th><th>Trigger</th><th>Runs</th><th>Open</th></tr></thead><tbody>{demoWorkflows.map((workflow) => <tr key={workflow.id}><td><div className="workflow-name"><span className="workflow-icon"><GitBranch size={16}/></span><span>{workflow.name}<span style={{ display: "block", color: "var(--muted)", fontWeight: 500, fontSize: 10, marginTop: 4 }}>{workflow.description}</span></span></div></td><td><span className={`status status-${workflow.status.toLowerCase()}`}>{workflow.status.toLowerCase()}</span></td><td>{workflow.triggerType.toLowerCase()}</td><td>{workflow.runs.toLocaleString("en-GB")}</td><td><Link href="/workflows/new" className="btn" style={{ padding: 7 }}>Open <ArrowRight size={12}/></Link></td></tr>)}</tbody></table></div></section><div className="panel" style={{ marginTop: 16, padding: 20, display: "flex", alignItems: "center", gap: 14 }}><span className="quick-icon"><Workflow size={18}/></span><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 800 }}>Ready to build something new?</div><div style={{ color: "var(--muted)", fontSize: 11, marginTop: 5 }}>Start with a trigger, add conditions and define your actions.</div></div><Link className="btn btn-primary" href="/workflows/new">Open builder <ArrowRight size={13}/></Link></div></div></AppShell>;
}
