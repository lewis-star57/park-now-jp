/**
 * 利用規約・出典ページ
 *
 * 免責ダイアログを閉じた後でもいつでも法務情報・出典情報を確認できる
 * 導線。トップ画面の右上「ⓘ」リンクから到達する。
 *
 * App Router の Server Component として実装（インタラクションなし）。
 * 静的エクスポート (trailingSlash: true) のもとで /about/ として配信される。
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { DATA_SOURCES, DISCLAIMER_TEXT } from "@park-now-jp/shared";

export const metadata: Metadata = {
  title: "出典・利用規約 — Park Now JP",
  description:
    "Park Now JP のデータ提供元、ライセンス、免責事項、連絡先のご案内。",
};

const REPO_URL = "https://github.com/lewis-star57/park-now-jp";

export default function AboutPage() {
  return (
    <main className="min-h-[100dvh] w-full bg-bg text-text px-5 py-8 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-2xl space-y-8">
        {/* 戻る導線 */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-text-dim hover:text-text"
        >
          <ArrowLeft size={16} />
          地図に戻る
        </Link>

        {/* タイトル */}
        <header>
          <h1 className="text-2xl font-bold">出典・利用規約</h1>
          <p className="text-sm text-text-dim mt-1">
            Park Now JP のデータ提供元・ライセンス・免責事項
          </p>
        </header>

        {/* 免責 */}
        <section
          aria-labelledby="disclaimer-heading"
          className="rounded-xl border border-status-paid/30 bg-status-paid/5 p-4"
        >
          <h2
            id="disclaimer-heading"
            className="text-base font-bold mb-2 flex items-center gap-2"
          >
            <span aria-hidden>⚠</span>
            ご利用上の注意
          </h2>
          <p className="text-sm leading-relaxed">{DISCLAIMER_TEXT}</p>
        </section>

        {/* データ提供 */}
        <section aria-labelledby="data-sources-heading" className="space-y-3">
          <h2 id="data-sources-heading" className="text-base font-bold">
            データ提供
          </h2>
          <ul className="space-y-3 text-sm">
            <li className="rounded-lg border border-line p-3">
              <p className="font-semibold mb-1">パーキングメーター・チケット</p>
              <ExternalA href={DATA_SOURCES.mpd.url}>
                {DATA_SOURCES.mpd.name}
              </ExternalA>
              <p className="text-xs text-text-dim mt-1">
                {DATA_SOURCES.mpd.license}
              </p>
              <p className="text-xs mt-1">
                <ExternalA href={DATA_SOURCES.mpd.termsUrl} small>
                  利用規約
                </ExternalA>
              </p>
            </li>
            <li className="rounded-lg border border-line p-3">
              <p className="font-semibold mb-1">祝日</p>
              <ExternalA href={DATA_SOURCES.cabinet_office.url}>
                {DATA_SOURCES.cabinet_office.name}
              </ExternalA>
              <p className="text-xs text-text-dim mt-1">
                {DATA_SOURCES.cabinet_office.license}
              </p>
            </li>
          </ul>
        </section>

        {/* 地図・OSS */}
        <section aria-labelledby="oss-heading" className="space-y-3">
          <h2 id="oss-heading" className="text-base font-bold">
            地図・使用 OSS
          </h2>
          <ul className="space-y-3 text-sm">
            <li className="rounded-lg border border-line p-3">
              <p className="font-semibold mb-1">地図タイル</p>
              <p>
                <ExternalA href="https://carto.com/basemaps/">
                  CARTO Voyager
                </ExternalA>
              </p>
              <p className="text-xs text-text-dim mt-1">
                Map data ©{" "}
                <ExternalA
                  href="https://www.openstreetmap.org/copyright"
                  small
                >
                  OpenStreetMap contributors
                </ExternalA>
              </p>
            </li>
            <li className="rounded-lg border border-line p-3">
              <p className="font-semibold mb-1">主要ライブラリ</p>
              <ul className="text-xs text-text-dim space-y-0.5 mt-1">
                <li>
                  <ExternalA
                    href="https://maplibre.org/maplibre-gl-js/docs/"
                    small
                  >
                    MapLibre GL JS
                  </ExternalA>{" "}
                  (BSD-3-Clause)
                </li>
                <li>
                  <ExternalA href="https://nextjs.org/" small>
                    Next.js
                  </ExternalA>{" "}
                  (MIT)
                </li>
                <li>
                  <ExternalA href="https://serwist.pages.dev/" small>
                    Serwist
                  </ExternalA>{" "}
                  (MIT)
                </li>
              </ul>
            </li>
          </ul>
        </section>

        {/* ライセンス・連絡先 */}
        <section aria-labelledby="license-heading" className="space-y-3">
          <h2 id="license-heading" className="text-base font-bold">
            本アプリについて
          </h2>
          <dl className="rounded-lg border border-line p-3 text-sm space-y-2">
            <div>
              <dt className="text-xs text-text-dim">ライセンス</dt>
              <dd>MIT License</dd>
            </div>
            <div>
              <dt className="text-xs text-text-dim">ソースコード</dt>
              <dd>
                <ExternalA href={REPO_URL}>{REPO_URL}</ExternalA>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-dim">不具合報告・要望</dt>
              <dd>
                <ExternalA href={`${REPO_URL}/issues`}>
                  GitHub Issues
                </ExternalA>
              </dd>
            </div>
          </dl>
        </section>

        {/* 戻る */}
        <div className="pt-4">
          <Link
            href="/"
            className="block w-full text-center py-3 rounded-lg bg-accent text-bg font-semibold text-sm"
          >
            地図に戻る
          </Link>
        </div>
      </div>
    </main>
  );
}

/** 外部リンクの統一表現（new tab + noopener + 矢印アイコン）。 */
function ExternalA({
  href,
  children,
  small,
}: {
  href: string;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 underline underline-offset-2 ${
        small ? "text-accent text-xs" : "text-accent"
      }`}
    >
      {children}
      <ExternalLink size={small ? 11 : 13} aria-hidden />
    </a>
  );
}
