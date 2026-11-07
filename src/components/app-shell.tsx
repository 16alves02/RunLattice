import Link from "next/link";
import { Activity, Blocks, BookOpen, Bot, CircleHelp, CreditCard, GitBranch, LayoutDashboard, LayoutTemplate, Plug, Workflow } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { BrandLogo } from "@/components/brand-logo";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/ai-assistant", label: "AI assistant", icon: Bot },
  { href: "/runs", label: "Execution history", icon: Activity },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

export function AppShell({ children, active = "Overview" }: { children: React.ReactNode; active?: string }) {
  return <div className="app-shell">
    <aside className="sidebar">
      <BrandLogo variant="sidebar" />
      <div><div className="eyebrow">Workspace</div><nav className="nav-list" aria-label="Main navigation">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={\`nav-item \${active === label ? "active" : ""}\`}><Icon size={16}/>{label}</Link>)}</nav></div>
      <div><div className="eyebrow">Manage</div><nav className="nav-list"><Link href="/workflows/new" className={\`nav-item \${active === "Builder" ? "active" : ""}\`}><GitBranch size={16}/>Workflow builder</Link><a className="nav-item" href="https://docs.bullmq.io/" target="_blank" rel="noreferrer"><BookOpen size={16}/>Documentation</a><a className="nav-item" href="https://github.com/16alves02" target="_blank" rel="noreferrer"><Blocks size={16}/>Developer profile</a></nav></div>
      <div className="sidebar-bottom"><WorkspaceSwitcher /><SignOutButton/><div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--muted)", fontSize: 10, padding: "18px 10px 0" }}><CircleHelp size={13}/> Built for learning and shipping</div></div>
    </aside>
    <main className="main"><header className="topbar"><div className="breadcrumb"><span style={{ color: "#e9eaec" }}>Workspace</span><span style={{ margin: "0 8px" }}>/</span>{active}</div><div className="top-actions"><span className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 6, height: 6, background: "#d8ad72", borderRadius: "50%" }}/> Execution engine · Early access</span><div className="avatar" title="Personal account">RL</div></div></header><nav className="mobile-nav" aria-label="Mobile navigation">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active === label ? "page" : undefined}><Icon size={14}/>{label}</Link>)}<Link href="/workflows/new" aria-current={active === "Builder" ? "page" : undefined}><GitBranch size={14}/>Workflow builder</Link></nav>{children}</main>
  </div>;
}
