import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { BillingActions } from "@/components/billing-actions";
import { getWorkspaceEntitlements } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { requireServerWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Billing",
  description: "Manage your RunLattice workspace plan and subscription.",
};

export default async function BillingPage() {
  const workspace = await requireServerWorkspace();
  const entitlements = await getWorkspaceEntitlements(workspace.organizationId);
  const customer = await prisma.billingCustomer.findUnique({
    where: { organizationId: workspace.organizationId },
    select: { id: true },
  });
  const checkoutReady = Boolean(
    process.env.STRIPE_SECRET_KEY
    && process.env.STRIPE_PRICE_PRO_MONTHLY
    && process.env.STRIPE_PRICE_TEAM_MONTHLY,
  );

  return <AppShell active="Billing"><div className="page">
    <div className="page-heading">
      <div><h1>Billing</h1><p className="subtitle">Manage your workspace plan, usage limits and subscription.</p></div>
      <span className="tag">{entitlements.plan.toUpperCase()} plan</span>
    </div>

    <section className="panel">
      <div className="panel-heading"><div><div className="panel-title">Current usage</div><div className="panel-subtitle">Workflow run limits reset monthly.</div></div></div>
      <div className="billing-usage">
        <div><span>Workflows</span><strong>{entitlements.usage.workflows} / {entitlements.limits.workflows}</strong></div>
        <div><span>Monthly runs</span><strong>{entitlements.usage.monthlyRuns.toLocaleString("en-GB")} / {entitlements.limits.monthlyRuns.toLocaleString("en-GB")}</strong></div>
        <div><span>Workspace members</span><strong>{entitlements.usage.members} / {entitlements.limits.members}</strong></div>
        <div><span>AI requests</span><strong>{entitlements.limits.aiRequests.toLocaleString("en-GB")} / month</strong></div>
      </div>
      {entitlements.subscription && <p className="panel-subtitle" style={{ marginTop: 16 }}>
        Subscription status: <strong>{entitlements.subscription.status}</strong>
        {entitlements.subscription.cancelAtPeriodEnd ? " · Cancels at the end of the current billing period" : ""}
      </p>}
    </section>

    <div className="billing-plan-grid">
      <section className="panel">
        <div className="panel-title">Free</div><div className="billing-price">€0 <span>/ month</span></div>
        <p className="panel-subtitle">For trying workflow automation.</p>
        <ul><li>3 workflows</li><li>100 runs per month</li><li>1 workspace member</li></ul>
        {entitlements.plan === "free" && <span className="tag">Current plan</span>}
      </section>
      <section className="panel">
        <div className="panel-title">Pro</div><div className="billing-price">€19 <span>/ month</span></div>
        <p className="panel-subtitle">For individuals and small teams.</p>
        <ul><li>25 workflows</li><li>5,000 runs per month</li><li>3 workspace members</li><li>100 AI requests per month</li></ul>
        {entitlements.plan === "pro" && <span className="tag">Current plan</span>}
      </section>
      <section className="panel">
        <div className="panel-title">Team</div><div className="billing-price">€49 <span>/ month</span></div>
        <p className="panel-subtitle">For growing teams and operations.</p>
        <ul><li>100 workflows</li><li>25,000 runs per month</li><li>10 workspace members</li><li>500 AI requests per month</li></ul>
        {entitlements.plan === "team" && <span className="tag">Current plan</span>}
      </section>
    </div>

    <section className="panel">
      <div className="panel-title">Subscription management</div>
      <p className="panel-subtitle">Checkout and subscription changes are processed by Stripe. Workspace access changes only after a verified webhook.</p>
      <BillingActions checkoutReady={checkoutReady} portalReady={Boolean(customer)} />
    </section>
  </div></AppShell>;
}
