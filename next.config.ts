import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["bullmq"],
  experimental: { optimizePackageImports: ["lucide-react"] },
};

export default nextConfig;
