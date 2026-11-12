"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, MessageCircle, Search, Sparkles, Workflow } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { workflowTemplates, type WorkflowTemplate } from "@/lib/workflow-templates";

const categories = ["All templates", "Communication", "Development"];

export function TemplateGallery() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All templates");
  const [creating, setCreating] = useState("");
  const [notice, setNotice] = useState("");
  const visibleTemplates = useMemo(() => workflowTemplates.filter((template) => {
    const matchesCategory = category === "All templates" || template.category === category;
    const searchable = [template.name, template.description, ...template.apps].join(" ").toLowerCase();
    return matchesCategory && searchable.includes(query.toLowerCase());
  }), [category, query]);

  async function createFromTemplate(template: WorkflowTemplate) {
    setCreating(template.id);
    setNotice("");
    const definition = template.definition;

    try {
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          definition,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.data?.id !== "string") {
        throw new Error(typeof result.error === "string" ? result.error : "The template could not be saved.");
      }
      router.push(`/workflows/new?workflow=${encodeURIComponent(result.data.id)}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The template could not be saved.");
      setCreating("");
    }
  }

  return <AppShell active="Templates"><div className="page">
    <div className="page-heading">
      <div><div style={{ color: "var(--accent)", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Start faster</div><h1>Template library</h1><p className="subtitle">Choose a starting point, then adapt every step to your process.</p></div>
      <Link className="btn btn-quiet" href="/workflows/new"><Workflow size={14}/> Open builder</Link>
    </div>
    <div className="demo-notice" role="note">Templates create editable drafts using supported triggers and real workflow actions. Connect the required service and complete the setup instructions before activating each workflow.</div>
    {notice && <div className="toast" role="alert">{notice}</div>}
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
      <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 360 }}><Search size={14} style={{ position: "absolute", left: 11, top: 12, color: "var(--muted)" }}/><input className="field-input" aria-label="Search templates" placeholder="Search templates or apps..." value={query} onChange={(event) => setQuery(event.target.value)} style={{ paddingLeft: 34 }}/></div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{categories.map((item) => <button key={item} className={category === item ? "btn btn-primary" : "btn btn-quiet"} onClick={() => setCategory(item)} aria-pressed={category === item}>{item}</button>)}</div>
    </div>
    <div className="template-grid">
      {visibleTemplates.map((template) => {
        const Icon = template.icon === "http" ? Workflow : MessageCircle;
        return <article className="panel template-card" key={template.id}>
          <div className="template-card-top"><span className="quick-icon"><Icon size={18}/></span><span className="tag">{template.category}</span></div>
          <h2>{template.name}</h2>
          <p>{template.description}</p>
          <div className="template-apps">{template.integrations.map((app) => <span className="tag" key={app}>{app}</span>)}</div>
          <p className="editor-help">{template.setupInstructions}</p>
          <div className="template-card-bottom"><span className="activity-meta">{template.definition.nodes.length} steps · Draft</span><button className="btn btn-primary" onClick={() => void createFromTemplate(template)} disabled={creating !== ""}>{creating === template.id ? "Creating…" : "Use template"}{creating === template.id ? null : <ArrowRight size={13}/>}</button></div>
        </article>;
      })}
      {visibleTemplates.length === 0 && <div className="panel empty-state" style={{ gridColumn: "1 / -1" }}>No templates match this search.</div>}
    </div>
    <section className="panel" style={{ marginTop: 18, padding: 20, display: "flex", alignItems: "center", gap: 14 }}>
      <span className="quick-icon"><Sparkles size={18}/></span><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 800 }}>Have something else in mind?</div><div className="activity-meta">The AI workflow assistant is part of the product roadmap. It is not connected in this prototype yet.</div></div><span className="tag">Planned</span>
    </section>
  </div></AppShell>;
}
