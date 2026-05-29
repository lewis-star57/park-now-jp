/**
 * Park Now JP — メインページ
 *
 * Phase 1 MVP の組み立て:
 *  - 地図表示（MapLibre + Voyager）
 *  - public/data/13.geojson を fetch して各メーターを評価
 *  - 評価結果（free / paid / closed）を properties._statusLevel に注入し
 *    MapLibre 側でデータ駆動に色分け
 *  - フィルターチップ（今すぐ無料 / 60分 / 二輪）
 *  - メーターをタップでボトムシート
 *  - 初回起動時に免責ダイアログ
 *  - 1分ごとに再評価して色を更新
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Feature } from "geojson";
import {
  evaluateStatus,
} from "@/lib/parking/status";
import { isHoliday } from "@/lib/holidays";
import type {
  MeterStatus,
  ParkingMeter,
  ParkingMeterCollection,
  ParkingMeterFeature,
  ParkingMeterGeometry,
} from "@park-now-jp/shared";
import { FilterChips, type FilterValue } from "@/components/filters/FilterChips";
import { MeterSheet } from "@/components/sheet/MeterSheet";
import { DisclaimerDialog } from "@/components/ui/DisclaimerDialog";
import { Toast, type ToastLevel, type ToastMessage } from "@/components/ui/Toast";

// MapLibre は SSR 不可なのでクライアントオンリーでロード。
// 重要: ここを `Map` という名前にすると下のスコープで `new Map<...>()` の
// グローバル Map コンストラクタを上書きしてしまうため必ず別名にする。
const MeterMap = dynamic(() => import("@/components/map/Map").then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-text-dim">
      地図を読み込み中…
    </div>
  ),
});

const DATA_URL = "/data/13.geojson";

/** 評価結果が埋め込まれた Feature の properties */
type AnnotatedProperties = ParkingMeter & {
  _statusLevel: MeterStatus["level"];
};

type AnnotatedCollection = {
  type: "FeatureCollection";
  features: Array<Feature<ParkingMeterGeometry, AnnotatedProperties>>;
};

export default function HomePage() {
  const [raw, setRaw] = useState<ParkingMeterCollection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const [filter, setFilter] = useState<FilterValue>({
    freeNow: false,
    limit60: false,
    motorcycle: false,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // データ取得。エラー時のリトライボタンと online イベントから再利用するため
  // 関数化。返り値は cleanup（useEffect から呼ばれた場合のキャンセル用）。
  const loadData = useCallback((): (() => void) => {
    let cancelled = false;
    setError(null);
    setLoading(true);
    fetch(DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ParkingMeterCollection>;
      })
      .then((data) => {
        if (!cancelled) {
          setRaw(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 一時的な通知（トースト）。同じ文言でも id を変えて再表示できるようにする。
  const showToast = useCallback((text: string, level: ToastLevel) => {
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, text, level }));
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  // 初回ロード
  useEffect(() => {
    return loadData();
  }, [loadData]);

  // ネット復帰時の自動リトライ（エラー状態が残っているときだけ）
  useEffect(() => {
    if (!error) return;
    const onOnline = () => loadData();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [error, loadData]);

  // 1分ごとに再評価
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // 評価＋フィルター適用
  const { annotated, hitCount, totalCount, statusById, meterById } = useMemo(() => {
    if (!raw) {
      return {
        annotated: { type: "FeatureCollection", features: [] } as AnnotatedCollection,
        hitCount: 0,
        totalCount: 0,
        statusById: new Map<string, MeterStatus>(),
        meterById: new Map<string, ParkingMeterFeature>(),
      };
    }

    const statusById = new Map<string, MeterStatus>();
    const meterById = new Map<string, ParkingMeterFeature>();
    const features: AnnotatedCollection["features"] = [];

    for (const f of raw.features) {
      meterById.set(f.properties.id, f);
      const status = evaluateStatus(f.properties, now, isHoliday);
      statusById.set(f.properties.id, status);

      // フィルター
      if (filter.freeNow && status.level !== "free") continue;
      if (filter.limit60 && f.properties.timeLimitMinutes !== 60) continue;
      if (filter.motorcycle && f.properties.vehicleType !== "motorcycle") continue;

      features.push({
        ...f,
        properties: {
          ...f.properties,
          _statusLevel: status.level,
        },
      });
    }

    return {
      annotated: { type: "FeatureCollection", features },
      hitCount: features.length,
      totalCount: raw.features.length,
      statusById,
      meterById,
    };
  }, [raw, now, filter]);

  const selectedMeter = selectedId ? meterById.get(selectedId) ?? null : null;
  const selectedStatus = selectedId ? statusById.get(selectedId) ?? null : null;

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden">
      <MeterMap
        data={annotated as unknown as ParkingMeterCollection}
        onMeterClick={setSelectedId}
        onToast={showToast}
      />

      <FilterChips
        value={filter}
        onChange={setFilter}
        hitCount={hitCount}
        totalCount={totalCount}
      />

      {/* 凡例（左下） */}
      <div className="absolute left-3 bottom-24 sm:bottom-6 z-10 flex flex-col gap-1.5 px-3 py-2 rounded-lg bg-bg-elev/80 backdrop-blur border border-line text-xs">
        <LegendDot color="bg-status-free" label="今 無料" />
        <LegendDot color="bg-status-paid" label="稼働中（有料）" />
        <LegendDot color="bg-status-closed" label="駐車不可" />
      </div>

      {error && (
        <div
          role="alert"
          className="absolute top-20 left-1/2 -translate-x-1/2 z-20 max-w-[90vw] px-4 py-3 rounded-lg bg-status-closed/20 border border-status-closed/40 shadow-lg flex items-center gap-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold">データ読み込みエラー</p>
            <p className="text-xs text-text-dim mt-0.5 truncate">{error}</p>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="shrink-0 px-3 py-1.5 rounded bg-status-closed/40 hover:bg-status-closed/60 disabled:opacity-50 disabled:cursor-wait text-xs font-semibold whitespace-nowrap"
          >
            {loading ? "読込中…" : "再読込"}
          </button>
        </div>
      )}

      <MeterSheet
        meter={selectedMeter?.properties ?? null}
        status={selectedStatus}
        geometry={selectedMeter?.geometry ?? null}
        onClose={() => setSelectedId(null)}
      />

      <Toast toast={toast} onDismiss={dismissToast} />

      <DisclaimerDialog />
    </main>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}
