"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";

type Props = { workflowId: string; disabled?: boolean };
const initialInput = JSON.stringify({ customer: { score: 85 } }, null, 2);

export function ManualRunInput({ workflowId, disabled = false }: Props) {
  const router = useRouter();
  const [input, setInput] = useState(initialInput);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function queueRun() {
    if (disabled || submitting) return;
    let parsed: unknown;
    try { parsed = JSON.parse(input); }
    catch { setNotice("Run input must be valid JSON."); return; }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setNotice("Run input must be a JSON object.");
      return;
    }
    setSubmitting(true);
    setNotice("");
    try {
      const response = await fetch(`/api/workflows/${encodeURIComponent(workflowId)}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "The workflow run could not be queued.");
      setNotice("Run queued. Follow its progress in execution history.");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The workflow run could not be queued.");
    } finally { setSubmitting(false); }
  }

  return <section className="panel" style={{ marginBottom: 16 }}>
    <div className="panel-heading">
      <div><div className="panel-title">Manual run input</div><div className="panel-subtitle">JSON data available to condition rules and message templates</div></div>
      <span className="tag">32 KB max</span>
    </div>
    <div style={{ padding: 14, display: "grid", gap: 10 }}>
      <textarea className="field-input" aria-label="Manual run input JSON" rows={5} value={input} onChange={(event) => setInput(event.target.value)} spellCheck={false} disabled={disabled || submitting}/>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={() => void queueRun()} disabled={disabled || submitting}><Play size={13}/>{submitting ? "Queueing…" : "Queue run with this input"}</button>
        {notice && <span className="editor-help" role="status">{notice}</span>}
        {disabled && <span className="editor-help">Activate the workflow before running it.</span>}
      </div>
    </div>
  </section>;
}
