import type { Metadata } from "next";
import { AIWorkflowAssistant } from "@/components/ai-workflow-assistant";

export const metadata: Metadata = {
  title: "AI workflow assistant",
  description: "Turn a plain-language automation request into an editable workflow draft.",
};

export default function AIAssistantPage() {
  return <AIWorkflowAssistant />;
}
