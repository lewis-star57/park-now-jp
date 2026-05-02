/// <reference lib="WebWorker" />
/// <reference types="@serwist/next/typings" />

import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";

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
  runtimeCaching: [
    ...defaultCache,
    {
      // GeoJSON データは長めにキャッシュ（月次更新だから1週間でも実用上OK）
      urlPattern: /\/data\/.*\.geojson$/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "park-now-jp-data-v1",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 7, // 1週間
        },
      },
    },
    {
      // 地図タイル
      urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\//,
      handler: "CacheFirst",
      options: {
        cacheName: "park-now-jp-tiles-v1",
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
  ],
});

serwist.addEventListeners();
