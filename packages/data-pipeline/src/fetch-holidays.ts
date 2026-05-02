/**
 * 内閣府の祝日データを取得し、JSON 化するスクリプト
 *
 * ソース: https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv
 *
 * 出力先: apps/web/lib/holidays/data.json
 */

import { writeFile } from "node:fs/promises";
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

  const holidays: Holiday[] = records.map((r) => ({
    date: normalizeDate(r["国民の祝日・休日月日"]),
    name: r["国民の祝日・休日名称"],
  }));

  console.log(`✓ Parsed ${holidays.length} holidays`);

  await writeFile(outputPath, JSON.stringify(holidays, null, 2), "utf-8");
  console.log(`✓ Saved to ${outputPath}`);
}

/**
 * "2026/1/1" → "2026-01-01"
 */
function normalizeDate(raw: string): string {
  const [y, m, d] = raw.split("/").map((s) => s.padStart(2, "0"));
  return `${y.length === 2 ? "20" + y : y}-${m}-${d}`;
}

// CLI として実行可能に
if (import.meta.url === `file://${process.argv[1]}`) {
  const output = process.argv[2] ?? "../../apps/web/lib/holidays/data.json";
  fetchAndSaveHolidays(output).catch((err) => {
    console.error("✗ Failed:", err);
    process.exit(1);
  });
}
