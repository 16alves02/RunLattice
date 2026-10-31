import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "RunLattice | Workflow automation", template: "%s | RunLattice" },
  description: "Design workflow definitions, validate automation logic and monitor background execution from one workspace.",
  applicationName: "RunLattice",
  openGraph: {
    type: "website",
    siteName: "RunLattice",
    title: "RunLattice | Workflow automation",
    description: "Design, validate and monitor workflow automations from one workspace.",
  },
  twitter: {
    card: "summary",
    title: "RunLattice | Workflow automation",
    description: "Design, validate and monitor workflow automations from one workspace.",
  },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0c0d0f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
