import type { MetadataRoute } from "next";

// output: 'export' (静的エクスポート) では Next.js のメタデータルートが
// 既定では動的扱いになりビルドが失敗する。force-static で静的化を明示し、
// `out/manifest.webmanifest` として書き出される。
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Park Now JP — 今すぐ停められるパーキングメーター",
    short_name: "Park Now",
    description:
      "今この瞬間、停められるか？が一目でわかる、日本全国対応のパーキングメーター PWA",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0e14",
    theme_color: "#0a0e14",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/icon-72.png", sizes: "72x72", type: "image/png" },
      { src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" },
      { src: "/icons/icon-128.png", sizes: "128x128", type: "image/png" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["navigation", "travel", "utilities"],
    lang: "ja",
  };
}
