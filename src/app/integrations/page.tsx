import type { Metadata } from "next";
import { IntegrationGallery } from "@/components/integration-gallery";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Explore the services planned for the RunLattice integration library.",
};

export default function IntegrationsPage() {
  return <IntegrationGallery />;
}
