import { AIProviderSettings } from "@/components/ai-provider-settings";
import { AppShell } from "@/components/app-shell";
import { canManageWorkspace, requireServerWorkspace } from "@/lib/workspace";
import { redirect } from "next/navigation";

export const metadata = {
  title: "AI provider settings",
  description: "Manage encrypted workspace AI provider credentials.",
};

export default async function AIProviderSettingsPage() {
  const workspace = await requireServerWorkspace();
  if (!canManageWorkspace(workspace.role)) redirect("/");
  return <AppShell active="AI provider keys"><div className="page">
    <div className="page-heading">
      <div><h1>AI provider keys</h1><p className="subtitle">Control how this workspace pays for AI workflow planning.</p></div>
    </div>
    <AIProviderSettings />
  </div></AppShell>;
}
