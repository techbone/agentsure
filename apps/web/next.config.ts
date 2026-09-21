import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@agentsure/chain", "@agentsure/domain"],
};

export default nextConfig;
