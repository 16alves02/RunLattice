import Link from "next/link";
import { ArrowLeft, Workflow } from "lucide-react";

export default function NotFound() {
  return (
    <main className="not-found">
      <div className="not-found-card">
        <span className="not-found-icon"><Workflow size={22} /></span>
        <p className="not-found-code">404 · PAGE NOT FOUND</p>
        <h1>This route does not exist.</h1>
        <p className="subtitle">The page may have moved, or the address may be incorrect.</p>
        <Link href="/" className="btn btn-primary"><ArrowLeft size={14} /> Back to workspace</Link>
      </div>
    </main>
  );
}
