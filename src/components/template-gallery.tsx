"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileSpreadsheet, Mail, MessageCircle, ShoppingBag, Search, Sparkles, Workflow } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import type { WorkflowDefinition, WorkflowNode } from "@/lib/types";

type Template = {
  id: string;
  name: string;
  description: string;
  category: string;
  apps: string[];
  icon: typeof Mail;
  nodes: WorkflowNode[];
};

const templates: Template[] = [
  {
    id: "shopify-order-email",
    name: "Confirm a new order",
    description: "Start with a new Shopify order, check its payment status and prepare a customer confirmation email.",
    category: "E-commerce",
    apps: ["Shopify", "Gmail"],
    icon: ShoppingBag,
    nodes: [
      { id: "trigger-shopify", kind: "trigger", title: "New Shopify order", detail: "Trigger · Shopify webhook", x: 70, y: 90 },
      { id: "condition-payment", kind: "condition", title: "Payment confirmed", detail: "Condition · Check payment status", x: 350, y: 90 },
      { id: "action-email", kind: "action", title: "Send confirmation email", detail: "Action · Gmail", x: 630, y: 90 },
    ],
  },
  {
    id: "gmail-drive-attachment",
    name: "Save Gmail attachments to Drive",
    description: "Detect an incoming email attachment and prepare a step to save it in Google Drive.",
    category: "Productivity",
    apps: ["Gmail", "Google Drive"],
    icon: FileSpreadsheet,
    nodes: [
      { id: "trigger-gmail", kind: "trigger", title: "New Gmail attachment", detail: "Trigger · Gmail event", x: 70, y: 90 },
      { id: "action-drive", kind: "action", title: "Save file to Drive", detail: "Action · Google Drive", x: 350, y: 90 },
    ],
  },
  {
    id: "form-discord-alert",
    name: "Send form responses to Discord",
    description: "Prepare a notification whenever someone submits a form, with the response details included.",
    category: "Communication",
    apps: ["Forms", "Discord"],
    icon: MessageCircle,
    nodes: [
      { id: "trigger-form", kind: "trigger", title: "New form response", detail: "Trigger · Form webhook", x: 70, y: 90 },
      { id: "action-discord", kind: "action", title: "Send Discord message", detail: "Action · Discord", x: 350, y: 90 },
    ],
  },
  {
    id: "weekly-sales-report",
    name: "Create a weekly sales report",
    description: "Start on a weekly schedule, prepare a sales summary and send it to your team.",
    category: "Reporting",
    apps: ["Shopify", "Google Sheets", "Gmail"],
    icon: FileSpreadsheet,
    nodes: [
      { id: "trigger-schedule", kind: "trigger", title: "Every Monday", detail: "Trigger · Weekly schedule", x: 70, y: 90 },
      { id: "action-report", kind: "action", title: "Compile sales report", detail: "Action · Reporting", x: 350, y: 90 },
      { id: "action-send", kind: "action", title: "Email the report", detail: "Action · Gmail", x: 630, y: 90 },
    ],
  },
];

const categories = ["All templates", "E-commerce", "Productivity", "Communication", "Reporting"];

export function TemplateGallery() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All templates");
  const [creating, setCreating] = useState("");
  const [notice, setNotice] = useState("");
  const visibleTemplates = useMemo(() => templates.filter((template) => {
    const matchesCategory = category === "All templates" || template.category === category;
    const searchable = [template.name, template.description, ...template.apps].join(" ").toLowerCase();
    return matchesCategory && searchable.includes(query.toLowerCase());
  }), [category, query]);

  async function createFromTemplate(template: Template) {
    setCreating(template.id);
    setNotice("");
    const definition: WorkflowDefinition = {
      nodes: template.nodes,
      edges: template.nodes.slice(1).map((node, index) => ({
        id: `edge-${index + 1}`,
        from: template.nodes[index].id,
        to: node.id,
      })),
    };

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
    <div className="demo-notice" role="note">Templates create editable workflow drafts. The listed services are examples only: external accounts, integrations and real actions are not connected yet. Workflow execution is currently simulated.</div>
    {notice && <div className="toast" role="alert">{notice}</div>}
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
      <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 360 }}><Search size={14} style={{ position: "absolute", left: 11, top: 12, color: "var(--muted)" }}/><input className="field-input" aria-label="Search templates" placeholder="Search templates or apps..." value={query} onChange={(event) => setQuery(event.target.value)} style={{ paddingLeft: 34 }}/></div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{categories.map((item) => <button key={item} className={category === item ? "btn btn-primary" : "btn btn-quiet"} onClick={() => setCategory(item)} aria-pressed={category === item}>{item}</button>)}</div>
    </div>
    <div className="template-grid">
      {visibleTemplates.map((template) => {
        const Icon = template.icon;
        return <article className="panel template-card" key={template.id}>
          <div className="template-card-top"><span className="quick-icon"><Icon size={18}/></span><span className="tag">{template.category}</span></div>
          <h2>{template.name}</h2>
          <p>{template.description}</p>
          <div className="template-apps">{template.apps.map((app) => <span className="tag" key={app}>{app}</span>)}</div>
          <div className="template-card-bottom"><span className="activity-meta">{template.nodes.length} steps · Draft</span><button className="btn btn-primary" onClick={() => void createFromTemplate(template)} disabled={creating !== ""}>{creating === template.id ? "Creating…" : "Use template"}{creating === template.id ? null : <ArrowRight size={13}/>}</button></div>
        </article>;
      })}
      {visibleTemplates.length === 0 && <div className="panel empty-state" style={{ gridColumn: "1 / -1" }}>No templates match this search.</div>}
    </div>
    <section className="panel" style={{ marginTop: 18, padding: 20, display: "flex", alignItems: "center", gap: 14 }}>
      <span className="quick-icon"><Sparkles size={18}/></span><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 800 }}>Have something else in mind?</div><div className="activity-meta">The AI workflow assistant is part of the product roadmap. It is not connected in this prototype yet.</div></div><span className="tag">Planned</span>
    </section>
  </div></AppShell>;
}
