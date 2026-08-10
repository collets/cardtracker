import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    useTypeScriptCli: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cardtrader.com",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "www.cardtrader.com",
        pathname: "/uploads/**",
      },
    ],
  },
};

export default nextConfig;
