/**
 * 祝日判定モジュール
 *
 * 内閣府の syukujitsu.csv をビルド時に取得し、JSON 化してバンドル。
 * オフラインでも正確に動作する。
 *
 * データ更新: packages/data-pipeline/src/fetch-holidays.ts が
 * lib/holidays/data.json を更新する。
 *
 * @see https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html
 */

import { toZonedTime, format } from "date-fns-tz";
import type { Holiday } from "@park-now-jp/shared";
import { TIMEZONE } from "@park-now-jp/shared";

// ビルド時に data-pipeline が生成する祝日リスト
// 開発初期段階では空配列でもOK（fallback として動作）
import holidaysData from "./data.json";

const holidays: Holiday[] = holidaysData as Holiday[];

// 高速ルックアップ用の Set
const holidaySet = new Set(holidays.map((h) => h.date));

/**
 * 指定日が祝日かどうかを判定する。
 * タイムゾーンは Asia/Tokyo で正規化される。
 */
export function isHoliday(date: Date): boolean {
  const jst = toZonedTime(date, TIMEZONE);
  const ymd = format(jst, "yyyy-MM-dd", { timeZone: TIMEZONE });
  return holidaySet.has(ymd);
}

/**
 * 祝日名を取得する。祝日でない場合は null。
 */
export function getHolidayName(date: Date): string | null {
  const jst = toZonedTime(date, TIMEZONE);
  const ymd = format(jst, "yyyy-MM-dd", { timeZone: TIMEZONE });
  return holidays.find((h) => h.date === ymd)?.name ?? null;
}

/**
 * 全祝日リスト
 */
export function getAllHolidays(): readonly Holiday[] {
  return holidays;
}
