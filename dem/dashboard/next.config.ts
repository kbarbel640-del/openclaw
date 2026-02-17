import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@six-fingered-man/governance"],
  webpack: (config) => {
    // Governance package uses .js extensions in imports (TypeScript NodeNext convention)
    // but the actual files are .ts. Tell webpack to try .ts when .js is requested.
    config.resolve = config.resolve || {};
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
