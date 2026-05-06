import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kadenatrace/shared", "@kadenatrace/pact"],
  webpack(config) {
    if (config.resolve) {
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        crypto: false
      };
    }
    return config;
  }
};

export default nextConfig;
