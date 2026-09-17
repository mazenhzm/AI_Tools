import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security/headers";

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(isProduction),
      },
    ];
  },
};

export default nextConfig;
