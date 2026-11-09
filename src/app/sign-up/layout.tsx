import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Create an account",
  description: "Create a RunLattice workspace and start designing workflow automations.",
  robots: { index: false, follow: false },
};
export default function SignUpLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }