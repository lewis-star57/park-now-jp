/**
 * フィルターチップ（画面上部に固定表示）
 *
 * MVP: 3 つだけ
 *  - 今すぐ無料: 評価結果が free のメーターのみ
 *  - 60分: 制限時間 60 分のメーターのみ
 *  - 二輪: vehicleType === "motorcycle"
 */

"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { Info } from "lucide-react";

export interface FilterValue {
  freeNow: boolean;
  limit60: boolean;
  motorcycle: boolean;
}

interface FilterChipsProps {
  value: FilterValue;
  onChange: (next: FilterValue) => void;
  /** ヒット件数（フィルター後）— 表示の補助 */
  hitCount: number;
  totalCount: number;
}

interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function Chip({ active, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "px-3.5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors border",
        active
          ? "bg-accent text-bg border-accent"
          : "bg-bg-elev/80 text-text border-line backdrop-blur"
      )}
    >
      {children}
    </button>
  );
}

export function FilterChips({ value, onChange, hitCount, totalCount }: FilterChipsProps) {
  return (
    <div className="absolute top-0 left-0 right-0 z-10 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2 px-3 py-3 overflow-x-auto">
        <Chip
          active={value.freeNow}
          onClick={() => onChange({ ...value, freeNow: !value.freeNow })}
        >
          今すぐ無料
        </Chip>
        <Chip
          active={value.limit60}
          onClick={() => onChange({ ...value, limit60: !value.limit60 })}
        >
          60分
        </Chip>
        <Chip
          active={value.motorcycle}
          onClick={() => onChange({ ...value, motorcycle: !value.motorcycle })}
        >
          二輪
        </Chip>
        <div className="ml-auto pl-2 text-xs text-text-dim shrink-0">
          {hitCount} / {totalCount} 件
        </div>
        {/* 出典・利用規約への導線（about ページ） */}
        <Link
          href="/about/"
          aria-label="出典・利用規約"
          title="出典・利用規約"
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-bg-elev/80 backdrop-blur border border-line text-text-dim hover:text-text"
        >
          <Info size={16} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
