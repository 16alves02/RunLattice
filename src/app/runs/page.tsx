import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowRight, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Execution history",
  description: "Inspect workflow execution records stored in the RunLattice database.",
};

function formatDuration(startedAt: Date | null, finishedAt: Date | null) {
  if (!startedAt || !finishedAt) return "—";
  const milliseconds = Math.max(0, finishedAt.getTime() - startedAt.getTime());
  return milliseconds < 1000 ? `${milliseconds} ms` : `${(milliseconds / 1000).toFixed(2)} s`;
}

export default async function RunsPage() {
  let runs: Array<{
    id: string;
    workflowId: string;
    workflowName: string;
    status: string;
    createdAt: Date;
    startedAt: Date | null;
    finishedAt: Date | null;
    error: string | null;
  }> = [];
  let serviceUnavailable = false;
  let counts = { total: 0, succeeded: 0, failed: 0, queued: 0, running: 0 };

  try {
    const [records, total, succeeded, failed, queued, running] = await Promise.all([
      prisma.workflowRun.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { workflow: { select: { id: true, name: true } } },
      }),
      prisma.workflowRun.count(),
      prisma.workflowRun.count({ where: { status: "SUCCEEDED" } }),
      prisma.workflowRun.count({ where: { status: "FAILED" } }),
      prisma.workflowRun.count({ where: { status: "QUEUED" } }),
      prisma.workflowRun.count({ where: { status: "RUNNING" } }),
    ]);
    runs = records.map((run) => ({
      id: run.id,
      workflowId: run.workflow.id,
      workflowName: run.workflow.name,
      status: run.status,
      createdAt: run.createdAt,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      error: run.error,
    }));
    counts = { total, succeeded, failed, queued, running };
  } catch (error) {
    console.error("Unable to load execution history:", error instanceof Error ? error.message : "Unknown error");
    serviceUnavailable = true;
  }

  return <AppShell active="Execution history"><div className="page">
    <div className="page-heading"><div><h1>Execution history</h1><p className="subtitle">Inspect real workflow runs and their latest recorded status.</p></div><Link href="/workflows" className="btn">View workflows <ArrowRight size={13}/></Link></div>
    {serviceUnavailable && <div className="toast" role="alert">Execution history is unavailable. Check your database configuration and try again.</div>}
    <div className="stats-grid">
      <div className="stat-card"><div className="stat-label">Successful <CheckCircle2 size={15}/></div><div className="stat-value">{counts.succeeded.toLocaleString("en-GB")}</div><div className="stat-foot positive">Completed runs</div></div>
      <div className="stat-card"><div className="stat-label">Failed <XCircle size={15}/></div><div className="stat-value">{counts.failed.toLocaleString("en-GB")}</div><div className="stat-foot">Runs requiring review</div></div>
      <div className="stat-card"><div className="stat-label">In progress <Clock3 size={15}/></div><div className="stat-value">{(counts.queued + counts.running).toLocaleString("en-GB")}</div><div className="stat-foot">{counts.queued} queued · {counts.running} running</div></div>
      <div className="stat-card"><div className="stat-label">Total runs <Activity size={15}/></div><div className="stat-value">{counts.total.toLocaleString("en-GB")}</div><div className="stat-foot">All stored execution records</div></div>
    </div>
    <section className="panel"><div className="panel-heading"><div><div className="panel-title">Latest runs</div><div className="panel-subtitle">Most recent 100 records from PostgreSQL</div></div><span className="tag">{runs.length} shown</span></div>
      <div style={{ overflowX: "auto" }}><table className="workflow-table"><thead><tr><th>Run ID</th><th>Workflow</th><th>Status</th><th>Duration</th><th>Created</th></tr></thead><tbody>
        {runs.map((run) => <tr key={run.id}>
          <td style={{ fontFamily: "'DM Mono', monospace", color: "#a8adb4" }}>{run.id.slice(0, 12)}</td>
          <td style={{ color: "#f2f3f4", fontWeight: 700 }}><Link href={`/workflows/new?workflow=${encodeURIComponent(run.workflowId)}`}>{run.workflowName}</Link></td>
          <td><span className={`status ${run.status === "SUCCEEDED" ? "status-active" : run.status === "FAILED" ? "status-paused" : "status-draft"}`}>{run.status.toLowerCase()}</span>{run.error && <div style={{ color: "var(--muted)", fontSize: 10, marginTop: 4 }}>{run.error}</div>}</td>
          <td>{formatDuration(run.startedAt, run.finishedAt)}</td>
          <td>{run.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
        </tr>)}
        {runs.length === 0 && <tr><td colSpan={5}><div className="empty-state">{serviceUnavailable ? "Run records could not be loaded." : "No executions have been recorded yet."}</div></td></tr>}
      </tbody></table></div>
    </section>
  </div></AppShell>;
}
