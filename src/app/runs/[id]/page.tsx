import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { requireServerWorkspace } from "@/lib/workspace";
import { buildExecutionTrace, formatExecutionData } from "@/lib/execution-inspector";
import { workflowDefinitionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Execution inspector",
  description: "Inspect the recorded steps and data for a workflow execution.",
};

type PageProps = { params: Promise<{ id: string }> };

function formatDate(value: Date | null) {
  return value ? value.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function formatDuration(startedAt: Date | null, finishedAt: Date | null) {
  if (!startedAt) return "Not started";
  if (!finishedAt) return "In progress";
  const milliseconds = Math.max(0, finishedAt.getTime() - startedAt.getTime());
  return milliseconds < 1_000 ? `${milliseconds} ms` : `${(milliseconds / 1_000).toFixed(2)} s`;
}

function statusIcon(status: string) {
  if (status === "SUCCEEDED") return <CheckCircle2 size={15} />;
  if (status === "FAILED" || status === "OUTCOME_UNKNOWN") return <XCircle size={15} />;
  return <Clock3 size={15} />;
}

export default async function ExecutionInspectorPage({ params }: PageProps) {
  const workspace = await requireServerWorkspace();
  const { id } = await params;
  const run = await prisma.workflowRun.findFirst({
    where: { id, workflow: { organizationId: workspace.organizationId } },
    select: {
      id: true,
      status: true,
      input: true,
      output: true,
      error: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
      workflow: { select: { id: true, name: true, definition: true } },
      steps: {
        orderBy: { startedAt: "asc" },
        select: {
          id: true,
          nodeId: true,
          title: true,
          kind: true,
          attempt: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          result: true,
          error: true,
        },
      },
    },
  });

  if (!run) notFound();

  const parsedDefinition = workflowDefinitionSchema.safeParse(run.workflow.definition);
  const executionTrace = buildExecutionTrace(parsedDefinition.success ? parsedDefinition.data : undefined, run.steps);

  return <AppShell active="Execution history"><div className="page">
    <div className="page-heading">
      <div>
        <Link href="/runs" style={{ color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, marginBottom: 14 }}>
          <ArrowLeft size={13}/> Execution history
        </Link>
        <h1>Execution inspector</h1>
        <p className="subtitle">{run.workflow.name} · {run.id}</p>
      </div>
      <span className={`status ${run.status === "SUCCEEDED" ? "status-active" : run.status === "FAILED" ? "status-paused" : "status-draft"}`}>
        {run.status.toLowerCase().replaceAll("_", " ")}
      </span>
    </div>

    <div className="stats-grid">
      <div className="stat-card"><div className="stat-label">Created</div><div className="stat-value" style={{ fontSize: 16 }}>{formatDate(run.createdAt)}</div><div className="stat-foot">Execution requested</div></div>
      <div className="stat-card"><div className="stat-label">Started</div><div className="stat-value" style={{ fontSize: 16 }}>{formatDate(run.startedAt)}</div><div className="stat-foot">Worker start time</div></div>
      <div className="stat-card"><div className="stat-label">Duration</div><div className="stat-value">{formatDuration(run.startedAt, run.finishedAt)}</div><div className="stat-foot">Recorded execution time</div></div>
      <div className="stat-card"><div className="stat-label">Steps</div><div className="stat-value">{run.steps.length}</div><div className="stat-foot">Persisted step records</div></div>
    </div>

    {run.error && <div className="toast" role="alert">{run.error}</div>}

    <section className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-heading"><div><div className="panel-title">Execution path</div><div className="panel-subtitle">Steps recorded by the worker, in execution order</div></div><span className="tag">{run.steps.length} steps</span></div>
      {run.steps.length === 0 ? <div className="empty-state">No step records are available yet.</div> : <div style={{ display: "grid", gap: 10, padding: 16 }}>
        {executionTrace.map((step, index) => <article key={step.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="node-symbol">{index + 1}</span>
            <div style={{ flex: 1, minWidth: 150 }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{step.title}</div>
              <div style={{ color: "var(--muted)", fontSize: 10, marginTop: 3 }}>{step.kind} · {step.nodeId} · attempt {step.attempt}</div>
              {step.detail && <div style={{ color: "var(--muted)", fontSize: 10, marginTop: 3 }}>{step.detail}</div>}
            </div>
            <span className={`status ${step.status === "SUCCEEDED" ? "status-active" : step.status === "FAILED" || step.status === "OUTCOME_UNKNOWN" ? "status-paused" : "status-draft"}`} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              {statusIcon(step.status)} {step.status.toLowerCase().replaceAll("_", " ")}
            </span>
            {step.decision && <span className="tag">Condition → {step.decision.toUpperCase()}</span>}
            {step.enteredThroughBranch && <span className="tag">Entered {step.enteredThroughBranch.toUpperCase()} branch</span>}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 10, marginTop: 10 }}>
            {formatDate(step.startedAt)} · {formatDuration(step.startedAt, step.finishedAt)}
          </div>
          {step.error && <div style={{ color: "var(--danger, #e57373)", fontSize: 11, marginTop: 10 }}>{step.error}</div>}
          {step.result !== null && step.result !== undefined && <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 11 }}>View step output</summary>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 280, overflow: "auto", padding: 12, borderRadius: 8, background: "var(--surface-2, rgba(0,0,0,.18))", fontSize: 10 }}>{formatExecutionData(step.result)}</pre>
          </details>}
        </article>)}
      </div>}
    </section>

    <div className="workflow-layout" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
      <section className="panel">
        <div className="panel-heading"><div><div className="panel-title">Run input</div><div className="panel-subtitle">Redacted JSON input received by the workflow</div></div></div>
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 360, overflow: "auto", padding: 16, fontSize: 10 }}>{formatExecutionData(run.input)}</pre>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><div className="panel-title">Run output</div><div className="panel-subtitle">Redacted result stored by the worker</div></div></div>
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 360, overflow: "auto", padding: 16, fontSize: 10 }}>{formatExecutionData(run.output)}</pre>
      </section>
    </div>
    <div style={{ marginTop: 16 }}><Link href={`/workflows/new?workflow=${encodeURIComponent(run.workflow.id)}`} className="btn">Open workflow</Link></div>
  </div></AppShell>;
}
