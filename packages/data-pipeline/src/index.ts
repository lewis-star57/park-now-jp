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
import { mkdir, writeFile } from "node:fs/promises";
import { PREFECTURES, type PrefectureCode } from "@park-now-jp/shared";
import { fetchJarticData } from "./fetch-jartic";
import { buildGeoJsonForPrefecture } from "./to-geojson";
import { fetchAndSaveHolidays } from "./fetch-holidays";

const ROOT = path.resolve(__dirname, "../../..");
const WEB_DATA_DIR = path.join(ROOT, "apps/web/public/data");
const HOLIDAYS_PATH = path.join(ROOT, "apps/web/lib/holidays/data.json");
const CACHE_DIR = path.join(ROOT, ".cache/jartic");

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
      const records = dataMap.get(prefCode) ?? [];
      const meters = records.filter((r) => r.regulationCode === 72);
      const others = records.filter((r) =>
        [21, 22].includes(r.regulationCode)
      );

      const collection = buildGeoJsonForPrefecture(meters, others, prefCode);
      const outputPath = path.join(WEB_DATA_DIR, `${prefCode}.geojson`);

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
if (prefIdx !== -1 && argv[prefIdx + 1]) {
  cliArgs.prefectures = argv[prefIdx + 1].split(",") as PrefectureCode[];
}

main(cliArgs).catch((err) => {
  console.error("\n❌ Pipeline failed:", err);
  process.exit(1);
});
