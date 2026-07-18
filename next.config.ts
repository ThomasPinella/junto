import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Railway services must stay stateless (AGENTS.md, "Architecture and
  // security"): no local-disk persistence is configured here, and none may be
  // added later.
  typedRoutes: true,
};

export default nextConfig;
