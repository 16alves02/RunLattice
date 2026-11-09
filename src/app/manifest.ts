import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RunLattice",
    short_name: "RunLattice",
    description: "Design, validate and manage workflow automations.",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0d0f",
    theme_color: "#0c0d0f",
    icons: [
      { src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
    ],
  };
}