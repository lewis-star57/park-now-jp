/// <reference lib="WebWorker" />
/// <reference types="@serwist/next/typings" />

import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";

declare global {
  interface ServiceWorkerGlobalScope {
    __SW_MANIFEST: (string | { revision: string | null; url: string })[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

// ─────────────────────────────────────────────────────────────────────────
// ランタイムキャッシュの世代管理
//
// 2026-06-10 のデプロイ事故（旧SW・旧キャッシュが端末に残留し、サーバーから
// 消えた旧チャンクを参照し続けて地図が永遠に読み込み中になる）の再発防止策。
// すべてのランタイムキャッシュ名をこのプレフィックスで始め、activate 時に
// 「現行世代でも Serwist 管理（precache）でもないキャッシュ」を全削除する。
// キャッシュ戦略を変えるときは v2 → v3 へ上げるだけで古い世代が一掃される。
// ─────────────────────────────────────────────────────────────────────────
const CACHE_GENERATION = "park-now-v2-";

// この SW が「初回インストール」ではなく「既存 SW の置き換え」か。
// install 時点で active な SW がいれば置き換え（= デプロイによる更新）。
let isUpdate = false;
self.addEventListener("install", () => {
  isUpdate = self.registration.active !== null;
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // Serwist v9 では runtimeCaching の各エントリは
  //   { matcher: RegExp | string | RouteMatchCallback, handler: RouteHandler }
  // が必須形式。`urlPattern` + `handler: "StaleWhileRevalidate"` のような
  // 旧 Workbox 互換 API は廃止されている。
  // matcher は上から順に評価され、最初にマッチしたルールが使われる。
  runtimeCaching: [
    {
      // ページ遷移（HTML）: ネットワーク優先・オフライン時のみキャッシュ。
      // HTML をキャッシュ優先にすると、デプロイで旧チャンクが消えた後も
      // 旧 HTML が配信され続け、起動不能（ChunkLoadError）が固定化される。
      // 「リロードすれば必ず最新になる」ことを最優先にする。
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: `${CACHE_GENERATION}pages`,
        networkTimeoutSeconds: 5,
      }),
    },
    {
      // ハッシュ付きビルド成果物（/_next/static/...）: 内容不変なので
      // キャッシュ優先。基本は precache が先に応答するため、これは
      // precache から漏れた分（遅延ロード等）の保険。
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: `${CACHE_GENERATION}static`,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 256,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30日
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    {
      // GeoJSON データ: 表示は即（キャッシュ）、裏で更新（SWR）。
      // precache からは除外した（next.config.ts の exclude）ので、
      // ここが唯一のキャッシュ。データ更新は月次なので1週間で十分新鮮。
      matcher: /\/data\/.*\.geojson$/,
      handler: new StaleWhileRevalidate({
        cacheName: `${CACHE_GENERATION}data`,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 1週間
          }),
        ],
      }),
    },
    {
      // RSC ペイロード（/about などへのクライアント遷移が取得する .txt）。
      // オフラインでもページ間移動できるように SWR で保持する。
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && url.pathname.endsWith(".txt"),
      handler: new StaleWhileRevalidate({
        cacheName: `${CACHE_GENERATION}rsc`,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 32,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30日
          }),
        ],
      }),
    },
    {
      // アイコン等の同一オリジン画像
      matcher: ({ request, sameOrigin }) =>
        sameOrigin && request.destination === "image",
      handler: new StaleWhileRevalidate({
        cacheName: `${CACHE_GENERATION}images`,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30日
          }),
        ],
      }),
    },
    {
      // CARTO の地図スタイル定義（style.json）: 配信側で更新があり得るので
      // SWR（即表示しつつ裏で最新化）。
      matcher: ({ url }) =>
        url.hostname.endsWith("basemaps.cartocdn.com") &&
        url.pathname.endsWith(".json"),
      handler: new StaleWhileRevalidate({
        cacheName: `${CACHE_GENERATION}carto-style`,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 16,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 1週間
          }),
        ],
      }),
    },
    {
      // CARTO のベクタータイル・フォント（実際に使っている地図素材）。
      // 一度見たエリアはオフラインでも地図が描けるよう CacheFirst。
      // 端末内キャッシュ（ブラウザキャッシュと同等の範囲）に留め、
      // maxEntries と purgeOnQuotaError で容量を制御する。
      matcher: ({ url }) => url.hostname.endsWith("basemaps.cartocdn.com"),
      handler: new CacheFirst({
        cacheName: `${CACHE_GENERATION}carto-tiles`,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 500,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30日
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    {
      // OpenStreetMap ラスタータイル（将来 Voyager から切り替えた場合の保険）
      matcher: /^https:\/\/.*\.tile\.openstreetmap\.org\//,
      handler: new CacheFirst({
        cacheName: `${CACHE_GENERATION}osm-tiles`,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 500,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30日
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
  ],
});

serwist.addEventListeners();

// ─────────────────────────────────────────────────────────────────────────
// 旧世代キャッシュの一掃 + 既に壊れている端末の自動回復
//
// 1) 掃除: 「Serwist 管理（名前に "serwist" を含む = precache 等）」でも
//    「現行世代（CACHE_GENERATION で始まる）」でもないキャッシュを全削除。
//    旧構成（park-now-jp-*-v1 や defaultCache 由来）の残骸をここで断つ。
// 2) 回復: SW の置き換え時は、開いている全ページを同じ URL で再読込する。
//    旧 HTML を表示したままの端末（無限読み込み中の端末を含む）が、
//    ユーザー操作なしで新ビルドに入れ替わる。初回インストール時は
//    リロードしない（通常閲覧を邪魔しない）。
// ─────────────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              !name.includes("serwist") && !name.startsWith(CACHE_GENERATION),
          )
          .map((name) => caches.delete(name)),
      );
      if (isUpdate) {
        // navigate() は「この SW が制御しているクライアント」にしか使えない
        // ため、先に確実に制御を取る（claim は冪等なので二重でも無害）。
        await self.clients.claim();
        const clients = await self.clients.matchAll({ type: "window" });
        await Promise.all(
          clients.map((client) =>
            client instanceof WindowClient
              ? client.navigate(client.url).catch(() => null)
              : Promise.resolve(null),
          ),
        );
      }
    })(),
  );
});
