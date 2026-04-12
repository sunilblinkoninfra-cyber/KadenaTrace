import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kadenatrace/shared", "@kadenatrace/pact"]
};

export default nextConfig;

