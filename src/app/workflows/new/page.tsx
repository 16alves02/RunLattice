import type { Metadata } from "next";
import { WorkflowBuilder } from "@/components/workflow-builder";
import { requireServerWorkspace } from "@/lib/workspace";

export const metadata: Metadata = {
  title: "Workflow builder",
  description: "Create and edit workflow definitions with triggers, conditions and actions.",
};

type PageProps = {
  searchParams: Promise<{ workflow?: string }>;
};

export default async function NewWorkflowPage({ searchParams }: PageProps) {
  await requireServerWorkspace();
  const { workflow } = await searchParams;
  return <WorkflowBuilder workflowId={workflow} />;
}
