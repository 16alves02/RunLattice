import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowRight, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";

const runs = [
  { id: "run_01HTQ2", workflow: "Lead capture pipeline", status: "Succeeded", duration: "420 ms", time: "Today, 22:14:06" },
  { id: "run_01HTQ1", workflow: "Weekly report", status: "Queued", duration: "—", time: "Today, 21:58:31" },
  { id: "run_01HTPZ", workflow: "Lead capture pipeline", status: "Succeeded", duration: "386 ms", time: "Today, 21:44:19" },
  { id: "run_01HTPY", workflow: "Support triage", status: "Failed", duration: "1.2 s", time: "Today, 20:07:52" },
];

export const metadata: Metadata = {
  title: "Execution history",
  description: "Explore the RunLattice execution history interface using illustrative sample records.",
};

export default function RunsPage() {
  return <AppShell active="Execution history"><div className="page"><div className="page-heading"><div><h1>Execution history</h1><p className="subtitle">Inspect recent workflow runs and their final status.</p></div><Link href="/workflows" className="btn">View workflows <ArrowRight size={13}/></Link></div><div className="toast" role="note">Demo mode: all records and metrics on this page are illustrative, not real workflow executions.</div><div className="stats-grid"><div className="stat-card"><div className="stat-label">Successful <CheckCircle2 size={15}/></div><div className="stat-value">1,621</div><div className="stat-foot positive">98.6% of demo runs</div></div><div className="stat-card"><div className="stat-label">Failed <XCircle size={15}/></div><div className="stat-value">22</div><div className="stat-foot">Review failures before retrying</div></div><div className="stat-card"><div className="stat-label">Queued <Clock3 size={15}/></div><div className="stat-value">3</div><div className="stat-foot">Waiting for a worker</div></div><div className="stat-card"><div className="stat-label">Total runs <Activity size={15}/></div><div className="stat-value">1,643</div><div className="stat-foot">Sample data for the interface</div></div></div><section className="panel"><div className="panel-heading"><div><div className="panel-title">Latest runs</div><div className="panel-subtitle">Sample data to demonstrate the history interface</div></div><span className="tag">4 shown</span></div><div style={{ overflowX: "auto" }}><table className="workflow-table"><thead><tr><th>Run ID</th><th>Workflow</th><th>Status</th><th>Duration</th><th>Started</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id}><td style={{ fontFamily: "'DM Mono', monospace", color: "#a8adb4" }}>{run.id}</td><td style={{ color: "#f2f3f4", fontWeight: 700 }}>{run.workflow}</td><td><span className={`status ${run.status === "Succeeded" ? "status-active" : run.status === "Failed" ? "status-paused" : "status-draft"}`}>{run.status}</span></td><td>{run.duration}</td><td>{run.time}</td></tr>)}</tbody></table></div></section><div className="toast" style={{ marginTop: 16 }}>This page currently displays illustrative run data. Real run records will come from the PostgreSQL database and the BullMQ worker after setup.</div></div></AppShell>;
}
