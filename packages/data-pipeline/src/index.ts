#!/usr/bin/env node
/**
 * Park Now JP — Data Pipeline CLI
 *
 * 使い方:
 *   pnpm --filter @park-now-jp/data-pipeline run fetch          # 全データ取得
 *   pnpm --filter @park-now-jp/data-pipeline run fetch:tokyo    # 東京のみ
 *   pnpm --filter @park-now-jp/data-pipeline run fetch:holidays # 祝日のみ
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { PREFECTURES, type PrefectureCode } from "@park-now-jp/shared";
import { fetchJarticData } from "./fetch-jartic";
import { buildGeoJsonForPrefecture } from "./to-geojson";
import { fetchAndSaveHolidays } from "./fetch-holidays";

// ESM（"type": "module"）には __dirname が無く、参照すると起動した瞬間に
// ReferenceError でクラッシュするため import.meta.url から求める。
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../../..");
const WEB_DATA_DIR = path.join(ROOT, "apps/web/public/data");
const HOLIDAYS_PATH = path.join(ROOT, "apps/web/lib/holidays/data.json");
const CACHE_DIR = path.join(ROOT, ".cache/jartic");

/**
 * 警視庁オープンデータ（parking-meter.jp）で管理している都道府県。
 * JARTIC パイプラインからの上書きを禁止する（13.geojson は別経路で生成）。
 */
const MPD_MANAGED_PREFECTURES: PrefectureCode[] = ["13"];

interface CliArgs {
  prefectures?: PrefectureCode[];
  holidaysOnly?: boolean;
  metersOnly?: boolean;
}

async function main(args: CliArgs): Promise<void> {
  console.log("🅿️ Park Now JP — Data Pipeline");
  console.log("═".repeat(60));

  // 1. 祝日データ取得
  if (!args.metersOnly) {
    console.log("\n📅 Step 1/2: Fetching holidays from Cabinet Office...\n");
    await fetchAndSaveHolidays(HOLIDAYS_PATH);
  }

  // 2. JARTIC データ取得 → GeoJSON 変換
  if (!args.holidaysOnly) {
    console.log("\n🗾 Step 2/2: Fetching parking meter data from JARTIC...\n");

    const targets = args.prefectures ?? PREFECTURES.map((p) => p.code);
    const dataMap = await fetchJarticData({
      cacheDir: CACHE_DIR,
      prefectures: targets,
    });

    await mkdir(WEB_DATA_DIR, { recursive: true });

    for (const prefCode of targets) {
      // 安全弁1: 警視庁データ由来の県は JARTIC パイプラインで上書きしない
      if (MPD_MANAGED_PREFECTURES.includes(prefCode)) {
        console.warn(
          `⚠ ${prefCode}: 警視庁 parking-meter.jp 由来のデータで管理中のためスキップ（JARTIC で上書きしない）`
        );
        continue;
      }

      const records = dataMap.get(prefCode) ?? [];
      const meters = records.filter((r) => r.regulationCode === 72);
      const others = records.filter((r) =>
        [21, 22].includes(r.regulationCode)
      );

      const collection = buildGeoJsonForPrefecture(meters, others, prefCode);
      const outputPath = path.join(WEB_DATA_DIR, `${prefCode}.geojson`);

      // 安全弁2: 0件の結果で既存ファイルを上書きしない
      // （fetch-jartic 未実装・取得失敗時に実データを空で消し飛ばさないため）
      if (collection.features.length === 0) {
        console.warn(`⚠ ${prefCode}: 0 meters — 書き込みをスキップ（既存ファイルを保護）`);
        continue;
      }

      await writeFile(outputPath, JSON.stringify(collection), "utf-8");
      console.log(`✓ ${prefCode}: ${collection.features.length} meters → ${outputPath}`);
    }
  }

  console.log("\n✅ Done!\n");
}

// CLI 引数パース
const argv = process.argv.slice(2);
const cliArgs: CliArgs = {};

if (argv.includes("--holidays-only")) cliArgs.holidaysOnly = true;
if (argv.includes("--meters-only")) cliArgs.metersOnly = true;

const prefIdx = argv.indexOf("--pref");
const prefArg = prefIdx !== -1 ? argv[prefIdx + 1] : undefined;
if (prefArg) {
  cliArgs.prefectures = prefArg.split(",") as PrefectureCode[];
}

main(cliArgs).catch((err) => {
  console.error("\n❌ Pipeline failed:", err);
  process.exit(1);
});
