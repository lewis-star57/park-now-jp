import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  // public/ 配下の自動プリキャッシュを無効化（空配列の明示指定でスキャン停止）。
  // - 自動スキャンは Windows ビルドで URL に \ を混入させ（例: /data\13.geojson）、
  //   存在しない URL の取得失敗で SW のインストール自体が失敗する
  //   （2026-06-10 の本番障害の直接原因）
  // - GeoJSON・アイコン類はランタイムキャッシュ（app/sw.ts）に一本化する（M-4）
  additionalPrecacheEntries: [],
  // プリキャッシュ（SW インストール時の一括取得）から除外するもの:
  // - .map / manifest*.js: ビルドの副産物（既定の除外を維持）
  // - .html: ランタイムの NetworkFirst に一本化。旧 HTML が固定化されると
  //   デプロイで消えた旧チャンクを参照し続けて起動不能になるため
  // - .geojson: ランタイムの SWR に一本化（M-4: 二重保持・更新停滞の解消）
  exclude: [/\.map$/, /^manifest.*\.js$/, /\.html$/, /\.geojson$/],
});

const nextConfig: NextConfig = {
  // ──────────────────────────────────────────────────────────────────────
  // 静的エクスポート（VPS の nginx 配信用）
  //
  // - `next build` 後 `apps/web/out/` に静的ファイル一式が書き出される。
  // - PWA: @serwist/next が `public/sw.js` を生成 → そのまま `out/sw.js` に
  //   コピーされる。`app/manifest.ts` は静的ビルド時に
  //   `out/manifest.webmanifest` に書き出される。
  // - 旧 `headers()` の Cache-Control / CORS 設定は静的エクスポート非対応のため
  //   削除した。同等の挙動は VPS 側 nginx で設定する（リポジトリ別途文書化予定）。
  //   - /data/*.geojson → public, max-age=86400, stale-while-revalidate=604800
  //   - Access-Control-Allow-Origin: *
  // - PWA の SW が GeoJSON を runtimeCaching で StaleWhileRevalidate
  //   キャッシュするため、nginx 設定が来るまでの間も実用上の影響は小さい。
  // ──────────────────────────────────────────────────────────────────────
  output: "export",

  // ディレクトリ構造で静的配信する（nginx 標準の `try_files $uri $uri/` で
  // 自然に動作する）。将来 /about などのページが増えても保守しやすい。
  trailingSlash: true,

  // `next/image` は使っていないが、output: 'export' 環境での
  // 既定 loader 警告を抑止する保険。
  images: { unoptimized: true },

  reactStrictMode: true,

  experimental: {
    optimizePackageImports: ["lucide-react", "maplibre-gl"],
  },
};

export default withSerwist(nextConfig);
