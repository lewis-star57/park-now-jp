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

import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type {
  DayOfWeek,
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
 * @param now  現在時刻（実時刻。内部で JST に正規化する）
 * @param isHoliday 指定時刻（実時刻）が JST で祝日かどうかを返す関数
 * @returns ステータスオブジェクト
 */
export const evaluateStatus: StatusEvaluator = (meter, now, isHoliday) => {
  // すべての判定は JST で行う
  const jst = toZonedTime(now, TIMEZONE);
  const day = jst.getDay() as DayOfWeek;
  // isHoliday には変換前の now をそのまま渡す（isHoliday が内部で JST に正規化する）。
  // toZonedTime 済みの jst を渡すと二重変換になり、日本時間以外の端末では
  // JST 15時以降の祝日判定が翌日にズレる（例: 祝日前日の夕方に「無料」誤表示）。
  const holiday = isHoliday(now);

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
  // noUncheckedIndexedAccess 配下では分割代入が undefined を含むため、
  // ?? 0 で防御的に扱う（実データは "HH:MM" 固定形式）。
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * 次にステータスが変わる時刻（おおよそ）を実時刻（UTC 基準の Date）で返す。
 * UI で「あと N 分で稼働終了」等を表示するために使う。
 *
 * 簡易実装: 現在アクティブな稼働時間帯のうち、最も近い終了時刻を返す。
 * 日跨ぎ稼働（例: 22:00-06:00）では終了時刻が翌日になる。
 *
 * 実行環境のタイムゾーンに依存しないよう、JST の壁時計で目標時刻を
 * 組み立ててから fromZonedTime で実時刻へ変換する（setHours +
 * toISOString だけだと端末 TZ が JST のときしか正しくならない）。
 *
 * @param meter 評価対象のメーター
 * @param jst evaluateStatus が toZonedTime で作る JST 壁時計表現
 */
function nextHourBoundary(meter: ParkingMeter, jst: Date): Date {
  const minutesNow = jst.getHours() * 60 + jst.getMinutes();

  // 現在アクティブな時間帯それぞれの終了時刻（当日 0:00 からの分。翌日終了は +24h）
  const endCandidates: number[] = [];
  for (const h of meter.operatingHours) {
    const start = hhmmToMinutes(h.startTime);
    const end = hhmmToMinutes(h.endTime);
    if (end < start) {
      // 日跨ぎ（例: 22:00-06:00）
      if (minutesNow >= start) {
        endCandidates.push(end + 24 * 60); // 夜側にいる → 終了は翌日の end
      } else if (minutesNow < end) {
        endCandidates.push(end); // 深夜〜早朝側にいる → 終了は当日の end
      }
    } else if (minutesNow >= start && minutesNow < end) {
      endCandidates.push(end);
    }
  }

  // JST 壁時計上で目標時刻を組み立てる（setMinutes は 1440 分超を翌日に繰り上げる）
  const wall = new Date(jst);
  wall.setHours(0, 0, 0, 0);
  if (endCandidates.length === 0) {
    // 稼働中でないのに呼ばれた場合の保険: 翌日 0:00
    wall.setDate(wall.getDate() + 1);
  } else {
    wall.setMinutes(Math.min(...endCandidates));
  }
  return fromZonedTime(wall, TIMEZONE);
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
