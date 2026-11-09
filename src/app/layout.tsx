import type { Metadata, Viewport } from "next";
import { CookieConsent } from "@/components/cookie-consent";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://runlattice-web-production.up.railway.app";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "RunLattice | Workflow automation", template: "%s | RunLattice" },
  description: "Design, validate and manage workflow automations from one workspace.",
  applicationName: "RunLattice",
  openGraph: {
    type: "website",
    siteName: "RunLattice",
    title: "RunLattice | Workflow automation",
    description: "Design, validate and monitor workflow automations from one workspace.",
    url: appUrl,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "RunLattice workflow automation workspace" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "RunLattice | Workflow automation",
    description: "Design, validate and monitor workflow automations from one workspace.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon.ico", type: "image/x-icon", sizes: "any" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#0c0d0f", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<CookieConsent /></body></html>;
}
