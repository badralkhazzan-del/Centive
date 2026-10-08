import type { NextConfig } from "next";

// PiringTani is a client-state demo app: every page is prerendered as static HTML
// and reads its data from the local repository (localStorage). Cache Components is
// left off on purpose, so that routes unmount normally between navigations, which
// keeps Demo Mode and the Playwright smoke test predictable.
const nextConfig: NextConfig = {
  reactStrictMode: true,
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
