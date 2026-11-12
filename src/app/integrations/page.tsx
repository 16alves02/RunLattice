import type { Metadata } from "next";
import { IntegrationGallery } from "@/components/integration-gallery";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Connect services and manage workspace integration credentials.",
};

export default function IntegrationsPage() {
  return <IntegrationGallery />;
}
