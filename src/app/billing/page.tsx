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
  const [customer, openBillingAlerts] = await Promise.all([
    prisma.billingCustomer.findUnique({
      where: { organizationId: workspace.organizationId },
      select: { id: true },
    }),
    prisma.stripeEvent.count({
      where: { organizationId: workspace.organizationId, actionRequired: true },
    }),
  ]);
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const checkoutAvailability = {
    pro: { month: stripeConfigured && Boolean(process.env.STRIPE_PRICE_PRO_MONTHLY), year: stripeConfigured && Boolean(process.env.STRIPE_PRICE_PRO_ANNUAL) },
    team: { month: stripeConfigured && Boolean(process.env.STRIPE_PRICE_TEAM_MONTHLY), year: stripeConfigured && Boolean(process.env.STRIPE_PRICE_TEAM_ANNUAL) },
    business: { month: stripeConfigured && Boolean(process.env.STRIPE_PRICE_BUSINESS_MONTHLY), year: stripeConfigured && Boolean(process.env.STRIPE_PRICE_BUSINESS_ANNUAL) },
  };

  const usageMeters = [
    { label: "Workflows ativos", used: entitlements.usage.activeWorkflows, limit: entitlements.limits.workflows },
    { label: "Execuções", used: entitlements.usage.monthlyRuns, limit: entitlements.limits.monthlyRuns },
    { label: "Integrações", used: entitlements.usage.integrations, limit: entitlements.limits.integrations },
    { label: "Créditos de IA", used: entitlements.usage.aiCredits, limit: entitlements.limits.aiRequests },
  ];
  const usageAlerts = usageMeters.flatMap((meter) => {
    const percentage = meter.limit > 0 ? Math.floor((meter.used / meter.limit) * 100) : 0;
    const threshold = percentage >= 90 ? 90 : percentage >= 75 ? 75 : percentage >= 50 ? 50 : null;
    return threshold ? [{ ...meter, percentage, threshold }] : [];
  });

  const plans = [
    { key: "free", name: "Free", price: "€0", description: "Para experimentar e automatizar tarefas simples.", limits: ["3 workflows ativos", "100 execuções/mês", "1 utilizador", "1 integração", "10 créditos de IA/mês", "Histórico visível: 7 dias"] },
    { key: "pro", name: "Pro", price: "€11,99", annual: "€9,99/mês · €119,88/ano", description: "Para utilização individual regular.", limits: ["20 workflows ativos", "1.000 execuções/mês", "1 utilizador", "5 integrações", "100 créditos de IA/mês", "Histórico visível: 30 dias"] },
    { key: "team", name: "Teams", price: "€34,99", annual: "€27,99/mês · €335,88/ano", description: "Para pequenas equipas que trabalham em conjunto.", limits: ["100 workflows ativos", "5.000 execuções/mês", "5 utilizadores", "15 integrações", "400 créditos de IA/mês", "Histórico visível: 90 dias"] },
    { key: "business", name: "Business", price: "€99,99", annual: "€84,99/mês · €1.019,88/ano", description: "Para operações com maior volume.", limits: ["500 workflows ativos", "20.000 execuções/mês", "15 utilizadores", "50 integrações", "1.200 créditos de IA/mês", "Histórico visível: 180 dias"] },
  ];

  return <AppShell active="Billing"><div className="page">
    <div className="page-heading">
      <div><h1>Billing</h1><p className="subtitle">Manage your workspace plan, usage limits and subscription.</p></div>
      <span className="tag">{entitlements.plan.toUpperCase()} plan</span>
    </div>

    <section className="panel">
      <div className="panel-heading"><div><div className="panel-title">Utilização atual</div><div className="panel-subtitle">As execuções e os créditos incluídos renovam no primeiro dia de cada mês (UTC). Modelos económicos consomem 1 crédito, modelos standard 3 e modelos avançados 5; BYOK não consome créditos RunLattice.</div></div></div>
      <div className="billing-usage">
        <div><span>Workflows ativos</span><strong>{entitlements.usage.activeWorkflows} / {entitlements.limits.workflows}</strong></div>
        <div><span>Execuções este mês</span><strong>{entitlements.usage.monthlyRuns.toLocaleString("pt-PT")} / {entitlements.limits.monthlyRuns.toLocaleString("pt-PT")}</strong></div>
        <div><span>Utilizadores</span><strong>{entitlements.usage.members} / {entitlements.limits.members}</strong></div>
        <div><span>Integrações ligadas</span><strong>{entitlements.usage.integrations} / {entitlements.limits.integrations}</strong></div>
        <div><span>Créditos IA utilizados</span><strong>{entitlements.usage.aiCredits.toLocaleString("pt-PT")} / {entitlements.limits.aiRequests.toLocaleString("pt-PT")}</strong></div>
        <div><span>Pedidos IA este mês</span><strong>{entitlements.usage.aiRequests.toLocaleString("pt-PT")}</strong></div>
        <div><span>Tokens IA utilizados</span><strong>{entitlements.usage.aiTokens.toLocaleString("pt-PT")} / {entitlements.limits.aiTokens.toLocaleString("pt-PT")}</strong></div>
      </div>
      <p className="panel-subtitle" style={{ marginTop: 16 }}>Concorrência máxima: {entitlements.limits.concurrentRuns} execução(ões). Histórico visível: últimos {entitlements.limits.historyDays} dias.</p>
      {entitlements.subscription && <p className="panel-subtitle" style={{ marginTop: 8 }}>
        Subscription status: <strong>{entitlements.subscription.status}</strong>
        {entitlements.subscription.cancelAtPeriodEnd ? " · Cancels at the end of the current billing period" : ""}
      </p>}
    </section>

    <section className="panel">
      <div className="panel-title">Alertas de utilização</div>
      {usageAlerts.length > 0
        ? <ul>{usageAlerts.map((alert) => <li key={alert.label}>{alert.label}: {alert.percentage}% utilizado. Atingiu o patamar de alerta de {alert.threshold}% ({alert.used.toLocaleString("pt-PT")} / {alert.limit.toLocaleString("pt-PT")}).</li>)}</ul>
        : <p className="panel-subtitle">Nenhum limite atingiu os 50% de utilização.</p>}
      <p className="panel-subtitle">Estes alertas aparecem nesta página. Notificações automáticas por email ainda não estão implementadas.</p>
    </section>

    <div className="billing-plan-grid">
      {plans.map((plan) => <section className="panel" key={plan.key}>
        <div className="panel-title">{plan.name}</div>
        <div className="billing-price">{plan.price} <span>/ mês</span></div>
        {plan.key !== "free" && <p className="panel-subtitle">Anual: {plan.annual}</p>}
        {plan.key !== "free" && <p className="panel-subtitle">Inclui período experimental de 14 dias.</p>}
        <p className="panel-subtitle">{plan.description}</p>
        <ul>{plan.limits.map((limit) => <li key={limit}>{limit}</li>)}</ul>
        {entitlements.plan === plan.key && <span className="tag">Plano atual</span>}
      </section>)}
      <section className="panel">
        <div className="panel-title">Enterprise</div>
        <div className="billing-price">Personalizado</div>
        <p className="panel-subtitle">Limites, suporte e condições ajustados ao volume e às necessidades da organização.</p>
      </section>
    </div>

    {openBillingAlerts > 0 && <section className="panel" role="status">
      <div className="panel-title">Revisão de faturação necessária</div>
      <p className="panel-subtitle">{openBillingAlerts} evento(s) de pagamento, reembolso ou risco requerem revisão. Consulte o Stripe Dashboard para investigar e resolver estes eventos.</p>
    </section>}

    <section className="panel">
      <div className="panel-title">Gestão da subscrição</div>
      <p className="panel-subtitle">Checkout e alterações de subscrição são processados pelo Stripe. O acesso só muda após confirmação de um webhook validado. Os preços apresentados são propostas comerciais; o checkout só aparece quando os respetivos preços de teste estiverem configurados.</p>
      <BillingActions availability={checkoutAvailability} portalReady={Boolean(customer)} />
    </section>
  </div></AppShell>;
}
