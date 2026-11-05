import { Dashboard } from "@/components/dashboard";
import { requireServerWorkspace } from "@/lib/workspace";

export default async function HomePage() {
  await requireServerWorkspace();
  return <Dashboard />;
}
