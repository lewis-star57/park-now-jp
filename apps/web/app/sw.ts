/// <reference lib="WebWorker" />
/// <reference types="@serwist/next/typings" />

import { defaultCache } from "@serwist/next/worker";
import {
  CacheFirst,
  ExpirationPlugin,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";

declare global {
  interface ServiceWorkerGlobalScope {
    __SW_MANIFEST: (string | { revision: string | null; url: string })[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // Serwist v9 では runtimeCaching の各エントリは
  //   { matcher: RegExp | string | RouteMatchCallback, handler: RouteHandler }
  // が必須形式。`urlPattern` + `handler: "StaleWhileRevalidate"` のような
  // 旧 Workbox 互換 API は廃止されている。
  runtimeCaching: [
    ...defaultCache,
    {
      // GeoJSON データは長めにキャッシュ（月次更新だから1週間でも実用上OK）
      matcher: /\/data\/.*\.geojson$/,
      handler: new StaleWhileRevalidate({
        cacheName: "park-now-jp-data-v1",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 1週間
          }),
        ],
      }),
    },
    {
      // OpenStreetMap ラスタータイル（将来 Voyager から切り替えた場合の保険）
      matcher: /^https:\/\/.*\.tile\.openstreetmap\.org\//,
      handler: new CacheFirst({
        cacheName: "park-now-jp-tiles-v1",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 500,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          }),
        ],
      }),
    },
  ],
});

serwist.addEventListeners();
