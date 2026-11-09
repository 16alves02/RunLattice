import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your RunLattice workspace and manage your workflow automations.",
  robots: { index: false, follow: false },
};
export default function SignInLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }