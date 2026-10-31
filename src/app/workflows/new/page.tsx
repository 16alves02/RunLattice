import type { Metadata } from "next";
import { WorkflowBuilder } from "@/components/workflow-builder";

export const metadata: Metadata = {
  title: "Workflow builder",
  description: "Create and edit a workflow draft with triggers, conditions and action nodes.",
};

export default function NewWorkflowPage() {
  return <WorkflowBuilder />;
}
