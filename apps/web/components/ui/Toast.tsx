/**
 * 軽量トースト（依存ライブラリなし）
 *
 * - 画面下中央に短時間表示し、一定時間後に自動で消える
 * - 手動で閉じるボタンも用意
 * - スクリーンリーダー向けに常設の aria-live 領域を持つ
 *   （要素のマウント/アンマウントに依存せず、テキスト変化で読み上げさせる）
 * - レベル（info / warn / error）でアイコンと枠線色を出し分ける
 *
 * 用途: 現在地取得の失敗など、モーダルにするほどでもない一時的な通知。
 * これまで window.alert() で出していたメッセージの置き換え。
 */

"use client";

import { useEffect } from "react";
import { clsx } from "clsx";
import { AlertCircle, AlertTriangle, Info, X, type LucideIcon } from "lucide-react";

export type ToastLevel = "info" | "warn" | "error";

export interface ToastMessage {
  /** 同じ文言を続けて出したときも再表示・再読み上げできるよう毎回変える連番 */
  id: number;
  text: string;
  level: ToastLevel;
}

/** 自動で消えるまでの時間 (ms) */
const AUTO_DISMISS_MS = 5000;

const LEVEL_STYLES: Record<ToastLevel, { border: string; icon: string; Icon: LucideIcon }> = {
  info: { border: "border-accent/50", icon: "text-accent", Icon: Info },
  warn: { border: "border-status-paid/50", icon: "text-status-paid", Icon: AlertTriangle },
  error: { border: "border-status-closed/50", icon: "text-status-closed", Icon: AlertCircle },
};

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  // toast が変わるたびに自動消去タイマーを張り直す。
  // onDismiss は呼び出し側で useCallback により安定参照にしておくこと。
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const style = toast ? LEVEL_STYLES[toast.level] : null;

  return (
    // 外側は常設の live 領域（空でも DOM に残す）。クリックは透過。
    <div
      aria-live="assertive"
      aria-atomic="true"
      className="pointer-events-none absolute inset-x-0 bottom-24 sm:bottom-10 z-30 flex justify-center px-4"
    >
      {toast && style && (
        <div
          className={clsx(
            "pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border bg-bg-elev/95 px-4 py-3 shadow-lg backdrop-blur",
            style.border
          )}
        >
          <style.Icon size={18} aria-hidden className={clsx("mt-0.5 shrink-0", style.icon)} />
          <p className="flex-1 text-sm leading-snug text-text">{toast.text}</p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="閉じる"
            className="-mr-1 -mt-0.5 shrink-0 rounded p-1 text-text-dim transition-colors hover:text-text"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
