/**
 * Status Evaluator — 「今この瞬間、停められるか」判定ロジック
 *
 * このファイルはプロジェクトの中で最も重要なロジックです。
 * 純粋関数として実装し、Date.now() などの副作用を一切持たないこと。
 * テスト容易性のため、現在時刻と祝日判定関数は引数で受け取ります。
 *
 * 判定の優先順位（厳守）:
 *   1. 同位置の他の駐車禁止規制（重複規制）→ closed
 *   2. メーター稼働時間中 → paid
 *   3. メーター時間外 + 駐禁規制が解除されている → free
 *   4. 上記以外 → closed（安全側に倒す）
 *
 * @see docs/STATUS_LOGIC.md
 */

import { toZonedTime } from "date-fns-tz";
import type {
  DayOfWeek,
  MeterStatus,
  OperatingHour,
  ParkingMeter,
  StatusEvaluator,
} from "@park-now-jp/shared";
import { TIMEZONE, VEHICLE_TYPE_LABELS } from "@park-now-jp/shared";

// ============================================================================
// 公開関数
// ============================================================================

/**
 * メーターの現在ステータスを評価する。
 *
 * @param meter 評価対象のメーター
 * @param now  現在時刻（UTC でも JST でも OK、内部で JST に正規化）
 * @param isHoliday 指定日が祝日かどうかを返す関数
 * @returns ステータスオブジェクト
 */
export const evaluateStatus: StatusEvaluator = (meter, now, isHoliday) => {
  // すべての判定は JST で行う
  const jst = toZonedTime(now, TIMEZONE);
  const day = jst.getDay() as DayOfWeek;
  const holiday = isHoliday(jst);

  // ────────────────────────────────────────────────────────────
  // ステップ 1: 重複する駐車禁止規制をチェック
  //   メーター時間外でも、24時間禁止や時間帯重複があれば停められない
  // ────────────────────────────────────────────────────────────
  const blockingRegulation = meter.overlappingRegulations.find((reg) => {
    if (reg.isAllDay) return true;
    if (!appliesOnDay(reg.operatingDays ?? [], day, holiday)) return false;
    if (!reg.operatingHours?.length) return false;
    return reg.operatingHours.some((h) => isWithinHours(jst, h));
  });

  // ────────────────────────────────────────────────────────────
  // ステップ 2: メーターが稼働中か判定
  // ────────────────────────────────────────────────────────────
  const meterIsOperating = isMeterOperating(meter, jst, day, holiday);

  // ────────────────────────────────────────────────────────────
  // ステップ 3: 状態を組み立て
  // ────────────────────────────────────────────────────────────
  if (meterIsOperating) {
    return {
      level: "paid",
      label: "稼働中",
      message: `${meter.timeLimitMinutes}分 ¥${meter.feeYen}`,
      detail: `パーキングメーター稼働中。${VEHICLE_TYPE_LABELS[meter.vehicleType] ?? "車種要確認"}が対象です。料金支払いで駐車可能。`,
      nextChangeAt: nextHourBoundary(meter, jst).toISOString(),
    };
  }

  // メーター稼働外
  if (blockingRegulation) {
    return {
      level: "closed",
      label: "駐車不可",
      message: blockingRegulation.isAllDay
        ? "24時間駐車禁止"
        : "他の駐車禁止規制中",
      detail: `メーター時間外ですが、${blockingRegulation.description} のため駐車できません。`,
      warning: "標識を必ず確認してください。",
    };
  }

  // メーター稼働外 かつ 重複規制なし → 無料で停められる
  return {
    level: "free",
    label: "無料駐車可",
    message: holiday ? "日祝のため無料" : "規制時間外 無料",
    detail: holiday
      ? "祝日のためメーターは停止中、駐車禁止規制も解除されています。無料で駐車できます。"
      : "メーター稼働時間外、かつ駐車禁止規制も解除されています。無料で駐車できます。",
    warning:
      "実地の標識・道路標示を必ず確認してください。場所により別の規制（駐車方法表示など）がある場合があります。",
  };
};

// ============================================================================
// 内部ヘルパー
// ============================================================================

/**
 * メーターが現在稼働しているかを判定。
 * 稼働 = (運用時間内) AND (運用曜日に該当)
 */
function isMeterOperating(
  meter: ParkingMeter,
  jst: Date,
  day: DayOfWeek,
  holiday: boolean
): boolean {
  // 曜日チェック
  if (!appliesOnDay(meter.operatingDays, day, holiday, meter.exclusions)) {
    return false;
  }

  // 時間帯チェック（複数の時間帯がある場合はいずれかに該当すれば稼働）
  return meter.operatingHours.some((h) => isWithinHours(jst, h));
}

/**
 * 指定の曜日 / 祝日に規制が適用されるか判定。
 *
 * @param operatingDays 適用曜日（空配列なら全曜日に適用）
 * @param day 評価対象の曜日
 * @param holiday 評価対象が祝日か
 * @param exclusions 除外条件
 */
function appliesOnDay(
  operatingDays: DayOfWeek[],
  day: DayOfWeek,
  holiday: boolean,
  exclusions: ParkingMeter["exclusions"] = []
): boolean {
  // 除外条件のチェック
  if (holiday && exclusions.includes("holidays")) return false;
  if (day === 0 && exclusions.includes("sundays")) return false;
  if (day === 6 && exclusions.includes("saturdays")) return false;

  // 適用曜日のチェック（空配列なら全曜日適用）
  if (operatingDays.length === 0) return true;
  return operatingDays.includes(day);
}

/**
 * 現在時刻が指定の時間帯内かどうか。
 * 時刻は "HH:MM" 形式の文字列。
 */
function isWithinHours(jst: Date, hour: OperatingHour): boolean {
  const minutesNow = jst.getHours() * 60 + jst.getMinutes();
  const startMinutes = hhmmToMinutes(hour.startTime);
  const endMinutes = hhmmToMinutes(hour.endTime);

  // 日跨ぎ対応（例: 22:00-06:00）
  if (endMinutes < startMinutes) {
    return minutesNow >= startMinutes || minutesNow < endMinutes;
  }
  return minutesNow >= startMinutes && minutesNow < endMinutes;
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

/**
 * 次にステータスが変わる時刻（おおよそ）。
 * UI で「あと N 分で稼働終了」等を表示するために使う。
 *
 * 簡易実装: メーターの一番近い終了時刻を返す
 */
function nextHourBoundary(meter: ParkingMeter, jst: Date): Date {
  const minutesNow = jst.getHours() * 60 + jst.getMinutes();
  const endMinutes = meter.operatingHours
    .map((h) => hhmmToMinutes(h.endTime))
    .filter((m) => m > minutesNow)
    .sort((a, b) => a - b)[0];

  if (endMinutes === undefined) {
    // 翌日の最初の開始時刻にする
    const next = new Date(jst);
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  const next = new Date(jst);
  next.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
  return next;
}

// ============================================================================
// 開発時のデバッグ用エクスポート
// ============================================================================

/** テスト・デバッグ用 */
export const _internals = {
  isMeterOperating,
  appliesOnDay,
  isWithinHours,
  hhmmToMinutes,
  nextHourBoundary,
};
