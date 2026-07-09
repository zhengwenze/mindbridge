import type { NextConfig } from "next";

const isStaticExport = process.env.NEXT_OUTPUT_EXPORT === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  trailingSlash: isStaticExport,
  ...(isStaticExport
    ? { output: "export" as const }
    : {
        async rewrites() {
          const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
          return [
            {
              source: "/api/:path*",
              destination: `${apiBaseUrl}/api/:path*`
            },
            {
              source: "/actuator/:path*",
              destination: `${apiBaseUrl}/actuator/:path*`
            }
          ];
        }
      })
};

export default nextConfig;
