import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Dashboard } from "@/components/dashboard";
import { Activity, ArrowRight, Bot, Braces, GitBranch, ShieldCheck, Workflow, Zap } from "lucide-react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function LandingPage() {
  return <main className="marketing">
    <header className="marketing-header">
      <Link href="/" className="marketing-brand" aria-label="RunLattice home"><span className="marketing-mark">RL</span><span>RunLattice</span></Link>
      <nav aria-label="Main navigation" className="marketing-nav"><a href="#how-it-works">How it works</a><a href="#capabilities">Capabilities</a><Link href="/sign-in">Sign in</Link><Link href="/sign-up" className="btn btn-primary">Get started <ArrowRight size={14}/></Link></nav>
    </header>
    <section className="marketing-hero">
      <div className="marketing-kicker"><span/> WORKFLOW AUTOMATION WORKSPACE</div>
      <h1>Turn repetitive work into <span>reliable workflows.</span></h1>
      <p className="marketing-lead">Design, validate and manage automations from one workspace. Start visually, then add the logic and integrations your process needs.</p>
      <div className="marketing-actions"><Link href="/sign-up" className="btn btn-primary">Create your workspace <ArrowRight size={15}/></Link><Link href="/sign-in" className="btn btn-quiet">Sign in</Link></div>
      <p className="marketing-note">Early access · Review workflows before activating them</p>
      <div className="marketing-preview" aria-label="Illustration of a workflow with a trigger, action and condition">
        <div className="preview-top"><span className="preview-dot"/><span className="preview-dot"/><span className="preview-dot"/><span>Workflow overview</span><span className="preview-status">Draft</span></div>
        <div className="preview-flow"><div className="preview-node"><span className="preview-node-icon"><Zap size={17}/></span><strong>Trigger</strong><small>Incoming event</small></div><span className="preview-connector"/><div className="preview-node"><span className="preview-node-icon"><Workflow size={17}/></span><strong>Action</strong><small>Run a workflow step</small></div><span className="preview-connector"/><div className="preview-node"><span className="preview-node-icon"><GitBranch size={17}/></span><strong>Condition</strong><small>Choose a path</small></div></div>
        <div className="preview-caption">Illustrative workflow · Configure and validate each step in the builder</div>
      </div>
    </section>
    <section id="capabilities" className="marketing-section"><div className="marketing-section-heading"><span className="marketing-kicker">BUILT AROUND YOUR WORK</span><h2>One workspace. Clear control.</h2><p>Keep workflow design, execution and operational visibility together.</p></div>
      <div className="marketing-features">
        <article><span><Workflow size={19}/></span><h3>Visual workflow builder</h3><p>Arrange triggers, actions and conditions, then validate the workflow before activation.</p></article>
        <article><span><Braces size={19}/></span><h3>Extend with HTTP</h3><p>Connect external services through controlled HTTP requests when a native connector is not available.</p></article>
        <article><span><Activity size={19}/></span><h3>Execution visibility</h3><p>Review execution history, statuses and errors from your workspace.</p></article>
        <article><span><ShieldCheck size={19}/></span><h3>Workspace security</h3><p>Use account protection, workspace permissions and integration credential controls.</p></article>
        <article><span><Bot size={19}/></span><h3>AI-assisted planning</h3><p>Turn a description into a workflow proposal to review before you use it.</p></article>
        <article><span><GitBranch size={19}/></span><h3>Reusable starting points</h3><p>Explore workflow templates and adapt them to your process.</p></article>
      </div>
    </section>
    <section id="how-it-works" className="marketing-how"><div><span className="marketing-kicker">A PRACTICAL WAY TO START</span><h2>From idea to a workflow you control.</h2></div><ol><li><strong>Describe the process</strong><span>Start with the outcome you want to achieve.</span></li><li><strong>Build and validate</strong><span>Review the steps, conditions and connections.</span></li><li><strong>Activate when ready</strong><span>Keep execution history available for follow-up.</span></li></ol></section>
    <section className="marketing-final"><h2>Make your next process easier to run.</h2><p>Create a workspace and start designing your first workflow.</p><Link href="/sign-up" className="btn btn-primary">Get started <ArrowRight size={15}/></Link></section>
    <footer className="marketing-footer"><span>© {new Date().getFullYear()} RunLattice</span><span>Workflow automation · Early access</span></footer>
    <div className="marketing-sticky"><Link href="/sign-up" className="btn btn-primary">Create your workspace <ArrowRight size={15}/></Link></div>
  </main>;
}

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return <LandingPage />;
  if (!session.user.twoFactorEnabled) redirect("/security");
  return <Dashboard />;
}
