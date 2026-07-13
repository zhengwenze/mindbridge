import type { NextConfig } from "next";

const isStaticExport = process.env.NEXT_OUTPUT_EXPORT === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  trailingSlash: isStaticExport,
  ...(isStaticExport ? { output: "export" as const } : {})
};

export default nextConfig;
