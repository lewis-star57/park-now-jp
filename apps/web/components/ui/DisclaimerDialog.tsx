/**
 * 初回起動時の免責ダイアログ
 *
 * - localStorage に同意フラグを保存（次回以降は表示しない）
 * - DISCLAIMER_TEXT は @park-now-jp/shared の定数を使用（変更禁止）
 * - 「同意して始める」を押すまでアプリの主要操作はブロック
 */

"use client";

import { useEffect, useState } from "react";
import { DISCLAIMER_TEXT, DATA_SOURCES } from "@park-now-jp/shared";

const STORAGE_KEY = "park-now-jp.disclaimer-accepted-v1";

export function DisclaimerDialog() {
  // SSR ハイドレーション中は描画しない（localStorage が無いため）
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const accepted = window.localStorage.getItem(STORAGE_KEY);
      if (accepted !== "1") setOpen(true);
    } catch {
      // localStorage 不可（プライベートブラウジング等）でも一応表示する
      setOpen(true);
    }
  }, []);

  const accept = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // 無視
    }
    setOpen(false);
  };

  if (!mounted || !open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclaimer-title"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-bg-elev border border-line p-6 shadow-2xl"
      >
        <h2 id="disclaimer-title" className="text-xl font-bold mb-3 flex items-center gap-2">
          <span aria-hidden>⚠</span>
          ご利用前の確認
        </h2>

        <p className="text-sm leading-relaxed text-text mb-4">{DISCLAIMER_TEXT}</p>

        <div className="text-xs text-text-dim space-y-3 border-t border-line pt-4 mb-5">
          <div>
            <p className="font-semibold text-text mb-1">データ提供</p>
            <ul className="space-y-1.5 pl-1">
              {/* メーター・チケットの主データ源（警視庁） */}
              <li>
                <a
                  href={DATA_SOURCES.mpd.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline"
                >
                  {DATA_SOURCES.mpd.name}
                </a>
                <span className="text-text-faint">（{DATA_SOURCES.mpd.license}）</span>
                <br />
                <a
                  href={DATA_SOURCES.mpd.termsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-faint underline text-[11px]"
                >
                  利用規約
                </a>
              </li>
              {/* 祝日データ */}
              <li>
                祝日データ:{" "}
                <a
                  href={DATA_SOURCES.cabinet_office.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline"
                >
                  {DATA_SOURCES.cabinet_office.name}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <button
          type="button"
          onClick={accept}
          className="w-full py-3 rounded-lg bg-accent text-bg font-bold text-sm"
        >
          同意して始める
        </button>
        <p className="text-[11px] text-text-faint text-center mt-3">
          詳しい出典・規約は{" "}
          <a href="/about/" className="underline">
            こちら
          </a>
        </p>
      </div>
    </div>
  );
}
