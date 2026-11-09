import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Mail } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
export const metadata: Metadata = {
  title: "Check your email",
  description: "Next steps for confirming your RunLattice account.",
  robots: { index: false, follow: false },
};
export default function ThankYouPage() {
  return <main className="auth-page"><section className="panel auth-card confirmation-card">
    <BrandLogo variant="auth" /><span className="confirmation-icon"><Mail size={23}/></span>
    <h1>Check your inbox</h1>
    <p className="subtitle">If your registration was accepted, an account verification message will be sent to the email address you provided. Follow its instructions before signing in.</p>
    <Link href="/sign-in" className="btn btn-primary confirmation-link"><CheckCircle2 size={15}/> Continue to sign in</Link>
    <p className="auth-footer">Did not receive a message? Check your spam folder or try signing up again.</p>
  </section></main>;
}