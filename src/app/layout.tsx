import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RunLattice — Workflow automation",
  description: "Design, run and monitor workflows from one clear workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
