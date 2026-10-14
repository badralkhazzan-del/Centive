import type { NextConfig } from "next";

// Pages are prerendered as static HTML. Without an account they read the local demo
// repository (localStorage); signed-in users read their live workspace from /api. Cache Components is
// left off on purpose, so that routes unmount normally between navigations, which
// keeps Demo Mode and the Playwright smoke test predictable.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Database drivers run on the server only and must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
