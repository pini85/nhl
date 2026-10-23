import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  cacheLife: {
    // Club data: refreshed on demand by the collector, with a 5-minute safety net.
    club: { stale: 60, revalidate: 300, expire: 86400 },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "media.contentapi.ea.com" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
