/**
 * メーター詳細ボトムシート
 *
 * 警視庁オープンデータ (parking-meter.jp 互換) のフィールドを表示する。
 * 表示内容は警視庁サイトのボトムシートに準拠：
 *  - ヘッダー: ステータス + 種別 (パーキング・メーター / チケット) + 補助 ID
 *  - 説明文: 種別とステータスに応じて文言を切り替え
 *  - 属性グリッド:
 *    - 利用できる時間帯 (operatingHours + restriction2)
 *    - 制限時間（手数料） — "60分以内 (300円)"
 *    - 種別
 *    - 対象車両 (アイコン付きで supports* を列挙)
 *    - 適用日 (restriction1 をそのまま)
 *  - 重複規制の警告
 *  - Google マップ経路リンク
 *  - 免責文
 */

"use client";

import { useEffect } from "react";
import { clsx } from "clsx";
import { X } from "lucide-react";
import {
  DISCLAIMER_TEXT,
  type MeterStatus,
  type ParkingMeter,
  type ParkingMeterGeometry,
} from "@park-now-jp/shared";
import { googleMapsDirectionsUrlFor } from "@/lib/geo/google-maps-url";

interface MeterSheetProps {
  meter: ParkingMeter | null;
  status: MeterStatus | null;
  /**
   * メーターの geometry（経路リンク用）。
   * Point / LineString / MultiLineString いずれにも対応。
   */
  geometry: ParkingMeterGeometry | null;
  onClose: () => void;
}

const LEVEL_STYLES = {
  free: {
    label: "今 無料",
    bg: "bg-status-free/15",
    fg: "text-status-free",
    dot: "bg-status-free",
  },
  paid: {
    label: "稼働中",
    bg: "bg-status-paid/15",
    fg: "text-status-paid",
    dot: "bg-status-paid",
  },
  closed: {
    label: "駐車不可",
    bg: "bg-status-closed/15",
    fg: "text-status-closed",
    dot: "bg-status-closed",
  },
} as const;

/** 対象車両アイコン定義（左から順に表示） */
const VEHICLE_DEFS: Array<{
  key: keyof Pick<
    ParkingMeter,
    "supportsStandard" | "supportsTruck" | "supportsMotorcycle" | "supportsSenior"
  >;
  icon: string;
  label: string;
}> = [
  { key: "supportsStandard", icon: "🚗", label: "普通車" },
  { key: "supportsTruck", icon: "🚚", label: "貨物用" },
  { key: "supportsMotorcycle", icon: "🏍️", label: "二輪車" },
  { key: "supportsSenior", icon: "♿", label: "標章車専用" },
];

/**
 * メーター ID から末尾の連番を抜き出して "#123" 形式で返す。
 * 例: "13_1" → "#1" / "13_3000123" → "#3000123" / 失敗時は元の id を返す。
 */
function shortLabelFromId(id: string): string {
  const parts = id.split("_");
  const tail = parts[parts.length - 1];
  return tail ? `#${tail}` : id;
}

/**
 * 種別とステータスに応じた説明文。
 * status.detail (status.ts が用意するもの) を上書きする
 * のではなく、補強する位置づけ。
 */
function descriptionForStatus(
  status: MeterStatus,
  category?: ParkingMeter["category"]
): string {
  // closed / free は status.ts の文言をそのまま使う方が情報量が多い
  if (status.level !== "paid") return status.detail;

  const kindLabel = category ?? "パーキング・メーター";
  return `${kindLabel}稼働中。料金支払いで駐車可能です。`;
}

export function MeterSheet({ meter, status, geometry, onClose }: MeterSheetProps) {
  // ESC キーで閉じる
  useEffect(() => {
    if (!meter) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [meter, onClose]);

  if (!meter || !status) return null;

  const levelStyle = LEVEL_STYLES[status.level];

  // ── 利用できる時間帯 ────────────────────────────────────────
  const hours = meter.operatingHours
    .map((h) => `${h.startTime}〜${h.endTime}`)
    .join(" / ");

  // ── 種別ラベル ────────────────────────────────────────────
  const categoryLabel = meter.category ?? "パーキング・メーター";

  // ── 対象車両 ──────────────────────────────────────────────
  // supports* が一つも true でないとき（古いデータ等）は vehicleType を fallback
  const supportsAny = VEHICLE_DEFS.some((v) => meter[v.key] === true);
  const supportedVehicles = supportsAny
    ? VEHICLE_DEFS.filter((v) => meter[v.key] === true)
    : VEHICLE_DEFS.filter((v) => {
        // fallback: vehicleType に対応するキーだけ true 扱い
        if (v.key === "supportsStandard") return meter.vehicleType === "standard";
        if (v.key === "supportsTruck") return meter.vehicleType === "truck";
        if (v.key === "supportsMotorcycle")
          return meter.vehicleType === "motorcycle";
        if (v.key === "supportsSenior") return meter.vehicleType === "senior";
        return false;
      });

  // ── 適用日 ────────────────────────────────────────────────
  // restriction1 は空文字で来ることがあるので、trim 後の長さで判定。
  const applicabilityLabel =
    meter.restriction1 && meter.restriction1.trim().length > 0
      ? meter.restriction1
      : null;

  // ── 経路リンク ────────────────────────────────────────────
  // Point / LineString / MultiLineString のいずれでも、geometry の代表点
  // （中央付近）を目的地として Google マップを開く。
  let mapsHref: string | null = null;
  if (geometry) {
    try {
      mapsHref = googleMapsDirectionsUrlFor(geometry);
    } catch {
      // 空座標などで失敗しても UI は壊さない
      mapsHref = null;
    }
  }

  return (
    <>
      {/* 背面の半透明オーバーレイ */}
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm"
      />

      {/* シート本体 */}
      <section
        role="dialog"
        aria-modal="true"
        className="fixed left-0 right-0 bottom-0 z-30 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-bg-elev border-t border-line shadow-2xl pb-[env(safe-area-inset-bottom)]"
      >
        {/* グラブハンドル */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-line" />
        </div>

        <header className="flex items-start gap-3 px-5 pt-2 pb-3">
          <div className="flex-1 min-w-0">
            <div
              className={clsx(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-2",
                levelStyle.bg,
                levelStyle.fg
              )}
            >
              <span className={clsx("w-2 h-2 rounded-full", levelStyle.dot)} />
              {levelStyle.label}
            </div>

            {/* 種別を主見出しに据える（警視庁サイト準拠）。識別 ID は補助情報。 */}
            <div className="flex items-baseline gap-2">
              <h2 className="text-xl font-bold leading-tight truncate">
                {categoryLabel}
              </h2>
              <span className="text-xs text-text-faint shrink-0">
                {shortLabelFromId(meter.id)}
              </span>
            </div>
            {meter.address && (
              <p className="text-xs text-text-dim mt-0.5">{meter.address}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            className="p-2 rounded-full text-text-dim hover:bg-line shrink-0"
          >
            <X size={20} />
          </button>
        </header>

        <div className="px-5 space-y-4">
          {/* メインメッセージ */}
          <p className="text-base font-semibold">{status.message}</p>
          <p className="text-sm text-text-dim leading-relaxed">
            {descriptionForStatus(status, meter.category)}
          </p>

          {/* 警告（重複規制など） */}
          {status.warning && (
            <div className="flex gap-2 p-3 rounded-lg bg-status-paid/10 border border-status-paid/30 text-sm">
              <span className="shrink-0">⚠</span>
              <p className="text-text">{status.warning}</p>
            </div>
          )}

          {/* 属性グリッド */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm py-3 border-t border-b border-line">
            <Row label="利用できる時間帯" wide>
              <div>{hours || "—"}</div>
              {meter.restriction2 && (
                <div className="text-xs text-text-dim mt-0.5">
                  {meter.restriction2}
                </div>
              )}
            </Row>

            <Row label="制限時間（手数料）" wide>
              {meter.timeLimitMinutes}分以内（{meter.feeYen}円）
            </Row>

            <Row label="種別">{categoryLabel}</Row>

            <Row label="適用日">
              {applicabilityLabel ?? "—"}
            </Row>

            <Row label="対象車両" wide>
              {supportedVehicles.length === 0 ? (
                <span className="text-text-dim">—</span>
              ) : (
                <div className="flex flex-wrap gap-2 mt-0.5">
                  {supportedVehicles.map((v) => (
                    <span
                      key={v.key}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-bg/60 border border-line text-xs"
                    >
                      <span aria-hidden>{v.icon}</span>
                      {v.label}
                    </span>
                  ))}
                </div>
              )}
            </Row>
          </dl>

          {/* 重複規制 */}
          {meter.overlappingRegulations.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-text-dim uppercase tracking-wider">
                同位置の他規制
              </h3>
              <ul className="space-y-1.5">
                {meter.overlappingRegulations.map((reg, idx) => (
                  <li
                    key={idx}
                    className="text-sm p-2 rounded bg-bg/60 border border-line"
                  >
                    {reg.description}
                    {reg.isAllDay && (
                      <span className="ml-2 text-status-closed">（24時間）</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 経路リンク */}
          {mapsHref && (
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-3 rounded-lg bg-accent text-bg font-semibold text-sm"
            >
              Google マップで経路を見る
            </a>
          )}

          {/* データ基準日（鮮度の判断材料として免責の直前に表示） */}
          <p className="text-[11px] leading-relaxed text-text-faint pt-2">
            データ基準日: {meter.lastUpdated}（警視庁 時間制限駐車区間案内地図）
          </p>

          {/* 免責 */}
          <p className="text-[11px] leading-relaxed text-text-faint">
            {DISCLAIMER_TEXT}
          </p>
        </div>
      </section>
    </>
  );
}

function Row({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={clsx(wide && "col-span-2")}>
      <dt className="text-[11px] text-text-faint">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
