"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { integrationCatalog } from "@/lib/integrations";

const categories = ["All", "Communication", "Productivity", "E-commerce", "Payments", "Development"];

export function IntegrationGallery() {
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => integrationCatalog.filter((item) => {
    const matchesCategory = category === "All" || item.category === category;
    const search = `${item.name} ${item.description} ${item.category}`.toLowerCase();
    return matchesCategory && search.includes(query.toLowerCase());
  }), [category, query]);

  return <AppShell active="Integrations"><div className="page">
    <div className="page-heading"><div><div style={{ color: "var(--accent)", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Connect your tools</div><h1>Integration library</h1><p className="subtitle">Explore the services RunLattice is being designed to connect.</p></div><span className="tag">0 connected</span></div>
    <div className="demo-notice" role="note">These are planned integration definitions, not live connections. OAuth, token storage and external actions are not implemented. Do not enter provider credentials in this prototype.</div>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}><input className="field-input" aria-label="Search integrations" placeholder="Search services..." value={query} onChange={(event) => setQuery(event.target.value)} style={{ maxWidth: 300 }}/><div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{categories.map((item) => <button key={item} className={category === item ? "btn btn-primary" : "btn btn-quiet"} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
    <div className="integration-grid">{visible.map((item) => <article className="panel integration-card" key={item.id}><div className="integration-card-head"><div className="quick-icon">{item.name.slice(0, 1)}</div><span className="tag">Planned</span></div><h2>{item.name}</h2><p>{item.description}</p><div className="activity-meta">Authentication: {item.auth}</div><div className="integration-capabilities"><div><strong>Triggers</strong><span>{item.triggers.join(" · ")}</span></div><div><strong>Actions</strong><span>{item.actions.join(" · ")}</span></div></div><button className="btn btn-quiet" disabled title="Provider connection is not available yet">Coming soon</button></article>)}</div>
    {visible.length === 0 && <div className="panel empty-state">No integrations match this search.</div>}
  </div></AppShell>;
}
