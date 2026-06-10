/**
 * 内閣府の祝日データを取得し、JSON 化するスクリプト
 *
 * ソース: https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv
 *
 * 出力先: apps/web/lib/holidays/data.json
 */

import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import iconv from "iconv-lite";
import { parse } from "csv-parse/sync";
import type { Holiday } from "@park-now-jp/shared";

const CABINET_OFFICE_HOLIDAYS_URL =
  "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv";

export async function fetchAndSaveHolidays(outputPath: string): Promise<void> {
  console.log(`📅 Fetching holidays from ${CABINET_OFFICE_HOLIDAYS_URL}`);

  const response = await fetch(CABINET_OFFICE_HOLIDAYS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch holidays: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const text = iconv.decode(buffer, "Shift_JIS");

  // CSV: 国民の祝日・休日月日,国民の祝日・休日名称
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as { "国民の祝日・休日月日": string; "国民の祝日・休日名称": string }[];

  // 内閣府 CSV は 1955 年からの全祝日を含むが、アプリの判定で使うのは現在の
  // 前後だけ。バンドルサイズを抑えるため前年以降のみを残す
  // （翌年分の祝日は毎年 2 月頃に CSV へ追加される → 月次更新で取り込まれる）。
  const fromYear = new Date().getFullYear() - 1;

  const holidays: Holiday[] = [];
  for (const r of records) {
    const date = normalizeDate(r["国民の祝日・休日月日"]);
    const name = r["国民の祝日・休日名称"];
    if (!date || !name) {
      console.warn(`⚠ Skipping malformed row: ${JSON.stringify(r)}`);
      continue;
    }
    if (Number(date.slice(0, 4)) >= fromYear) {
      holidays.push({ date, name });
    }
  }

  // 安全弁: 0件の結果で既存ファイルを上書きしない（CSV 形式変更等の検知）
  if (holidays.length === 0) {
    throw new Error("No holidays parsed — refusing to overwrite existing data.json");
  }

  console.log(
    `✓ Parsed ${holidays.length} holidays (${holidays[0]?.date} 〜 ${holidays[holidays.length - 1]?.date})`
  );

  await writeFile(outputPath, JSON.stringify(holidays, null, 2), "utf-8");
  console.log(`✓ Saved to ${outputPath}`);
}

/**
 * "2026/1/1" → "2026-01-01"。形式が不正な行は null を返す（呼び出し側でスキップ）。
 */
function normalizeDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const parts = raw.split("/");
  if (parts.length !== 3) return null;
  const [y = "", m = "", d = ""] = parts.map((s) => s.trim().padStart(2, "0"));
  const year = y.length === 2 ? `20${y}` : y;
  const normalized = `${year}-${m}-${d}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

// CLI として実行可能に。
// 注意: 素朴な `file://${argv[1]}` との比較は Windows のパス形式（C:\...）では
// 絶対に一致せず「無言でスキップ → 成功に見える」ため、pathToFileURL で
// URL に正規化してから比較する。
const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  const output = process.argv[2] ?? "../../apps/web/lib/holidays/data.json";
  fetchAndSaveHolidays(output).catch((err) => {
    console.error("✗ Failed:", err);
    process.exit(1);
  });
}
