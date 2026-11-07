import type { Metadata } from "next";
import { TemplateGallery } from "@/components/template-gallery";

export const metadata: Metadata = {
  title: "Templates",
  description: "Start workflow automations from editable RunLattice templates.",
};

export default function TemplatesPage() {
  return <TemplateGallery />;
}
