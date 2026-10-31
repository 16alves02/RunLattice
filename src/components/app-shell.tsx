import Link from "next/link";
import { Activity, Blocks, BookOpen, CircleHelp, GitBranch, LayoutDashboard, Settings2, Workflow } from "lucide-react";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/runs", label: "Execution history", icon: Activity },
];

export function AppShell({ children, active = "Overview" }: { children: React.ReactNode; active?: string }) {
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/"><span className="brand-mark">RL</span><span>runlattice<span style={{ color: "var(--accent)" }}>.</span></span></Link>
      <div><div className="eyebrow">Workspace</div><nav className="nav-list" aria-label="Main navigation">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-item ${active === label ? "active" : ""}`}><Icon size={16}/>{label}</Link>)}</nav></div>
      <div><div className="eyebrow">Manage</div><nav className="nav-list"><Link href="/workflows/new" className={`nav-item ${active === "Builder" ? "active" : ""}`}><GitBranch size={16}/>Workflow builder</Link><a className="nav-item" href="https://docs.bullmq.io/" target="_blank" rel="noreferrer"><BookOpen size={16}/>Documentation</a><a className="nav-item" href="https://github.com/16alves02" target="_blank" rel="noreferrer"><Blocks size={16}/>Developer profile</a></nav></div>
      <div className="sidebar-bottom"><div className="workspace-chip"><div className="workspace-avatar">FF</div><div style={{ minWidth: 0 }}><div style={{ fontSize: 11, fontWeight: 800 }}>Personal workspace</div><div style={{ color: "var(--muted)", fontSize: 10, marginTop: 4 }}>Free plan · Demo data</div></div><Settings2 size={15} color="var(--muted)"/></div><div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--muted)", fontSize: 10, padding: "18px 10px 0" }}><CircleHelp size={13}/> Built for learning and shipping</div></div>
    </aside>
    <main className="main"><header className="topbar"><div className="breadcrumb"><span style={{ color: "#e9eaec" }}>Workspace</span><span style={{ margin: "0 8px" }}>/</span>{active}</div><div className="top-actions"><span className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 6, height: 6, background: "#81c995", borderRadius: "50%" }}/> Prototype · Demo mode</span><div className="avatar" title="Demo workspace">RL</div></div></header><nav className="mobile-nav" aria-label="Mobile navigation">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active === label ? "page" : undefined}><Icon size={14}/>{label}</Link>)}<Link href="/workflows/new" aria-current={active === "Builder" ? "page" : undefined}><GitBranch size={14}/>Workflow builder</Link></nav>{children}</main>
  </div>;
}
