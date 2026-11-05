import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkflowBuilder } from "@/components/workflow-builder";
import { canManageWorkspace, requireServerWorkspace } from "@/lib/workspace";

export const metadata: Metadata = {
  title: "Workflow builder",
  description: "Create and edit workflow definitions with triggers, conditions and actions.",
};

type PageProps = {
  searchParams: Promise<{ workflow?: string }>;
};

export default async function NewWorkflowPage({ searchParams }: PageProps) {
  const workspace = await requireServerWorkspace();
  if (!canManageWorkspace(workspace.role)) redirect("/workflows");
  const { workflow } = await searchParams;
  return <WorkflowBuilder workflowId={workflow} />;
}
