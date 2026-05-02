import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PWA を本番のみ有効化（開発時は SW なし）
  ...(process.env.NODE_ENV === "production" && {
    headers: async () => [
      {
        source: "/data/:path*.geojson",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ],
  }),
  experimental: {
    optimizePackageImports: ["lucide-react", "maplibre-gl"],
  },
};

export default withSerwist(nextConfig);
