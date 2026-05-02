import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
  },
  // テストでは CSS / Tailwind を読まないので PostCSS をスキップ
  // （apps/web の postcss.config.js は Next.js 用）
  css: { postcss: { plugins: [] } },
  resolve: {
    alias: {
      "@park-now-jp/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@": path.resolve(__dirname, "."),
    },
  },
});
