/**
 * JARTIC オープンデータ取得モジュール
 *
 * https://www.jartic.or.jp/service/opendata/ から
 * 「交通規制情報（103種別）」の ZIP をダウンロードし、
 * 解凍して都道府県別 CSV を返す。
 *
 * 制約:
 * - JARTIC データは毎月月初に更新され、前月分は取得不可
 * - 文字コードは Shift_JIS
 * - 緯度経度は1セル内にスペース区切りで複数入る
 * - ダウンロードページは規約同意必須なので、URL を直接叩く必要がある
 *
 * 実装方針:
 * 1. 公式の ZIP URL を直接 fetch
 * 2. unzip して CSV を取得
 * 3. iconv-lite で Shift_JIS → UTF-8
 * 4. csv-parse でパース
 * 5. 規制種別 = 72 のみフィルター
 */

// 注意: ZIP ダウンロード・解凍の実装時には node:stream / node:fs / unzipper の
// import を戻すこと（下の TODO コメント内のコード例を参照）。
import { mkdir } from "node:fs/promises";
import iconv from "iconv-lite";
import { parse } from "csv-parse/sync";
import type { JarticRawRecord, PrefectureCode } from "@park-now-jp/shared";

// ============================================================================
// 設定
// ============================================================================

/**
 * JARTIC の交通規制情報（103種別）公開ページ URL
 *
 * TODO: 実際の ZIP URL は毎月変わる可能性があるため、
 * ページから動的に取得するスクレイピングを実装する必要がある。
 * 現状は固定 URL を仮置き。
 */
const JARTIC_BASE_URL = "https://www.jartic.or.jp/service/opendata/";

/** JARTIC のデータミラーサイト（参考: 過去データ保存用） */
const JARTIC_MIRROR_URL = "http://public-data.jartic-raws.durasite.net/opendata.html";

// ============================================================================
// 公開関数
// ============================================================================

export interface FetchOptions {
  /** 取得対象都道府県（省略時は全国） */
  prefectures?: PrefectureCode[];
  /** ダウンロード先ディレクトリ */
  cacheDir: string;
  /** 強制再取得 */
  force?: boolean;
}

/**
 * JARTIC データを取得し、都道府県別の生レコードを返す。
 */
export async function fetchJarticData(
  options: FetchOptions
): Promise<Map<PrefectureCode, JarticRawRecord[]>> {
  const { cacheDir, prefectures } = options;
  await mkdir(cacheDir, { recursive: true });

  // TODO: 実装ステップ
  //
  // 1. JARTIC のページを取得して当月の ZIP URL を抽出
  //    cheerio などでスクレイピング
  //
  // 2. ZIP をダウンロード
  //    const response = await fetch(zipUrl);
  //    await pipeline(Readable.fromWeb(response.body), createWriteStream(zipPath));
  //
  // 3. ZIP を解凍
  //    await pipeline(
  //      createReadStream(zipPath),
  //      unzipper.Extract({ path: extractDir })
  //    );
  //
  // 4. 各 CSV を読み込み（Shift_JIS）
  //    const buf = await readFile(csvPath);
  //    const utf8Text = iconv.decode(buf, "Shift_JIS");
  //    const records = parse(utf8Text, { columns: true, skip_empty_lines: true });
  //
  // 5. 都道府県別に整理
  //
  // 6. Map にして返す

  console.warn("⚠ fetchJarticData is not yet fully implemented");
  console.warn(`  Target: ${prefectures?.join(",") ?? "all 47 prefectures"}`);
  console.warn(`  Cache: ${cacheDir}`);
  console.warn(`  Source (to implement): ${JARTIC_BASE_URL}`);
  console.warn(`  See JARTIC_MIRROR_URL for past data: ${JARTIC_MIRROR_URL}`);

  return new Map();
}

// ============================================================================
// 内部ヘルパー（実装テンプレート）
// ============================================================================

/**
 * Shift_JIS の CSV を UTF-8 のレコード配列に変換
 */
export function parseShiftJisCSV(buffer: Buffer): Record<string, string>[] {
  const utf8Text = iconv.decode(buffer, "Shift_JIS");
  const records = parse(utf8Text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  return records as Record<string, string>[];
}

/**
 * "139.75425 35.18992 139.75500 35.19000" のような
 * スペース区切りの座標文字列を [lng, lat] のペア配列に変換
 */
export function parseCoordinates(raw: string): [number, number][] {
  const tokens = raw.trim().split(/\s+/).map(Number);
  if (tokens.length % 2 !== 0) {
    throw new Error(`Invalid coordinate string (odd token count): ${raw}`);
  }
  const pairs: [number, number][] = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const lng = tokens[i];
    const lat = tokens[i + 1];
    // NaN は大小比較がすべて false になり範囲チェックを素通りするため、
    // 先に数値として有効かを検査する
    if (
      lng === undefined ||
      lat === undefined ||
      !Number.isFinite(lng) ||
      !Number.isFinite(lat)
    ) {
      throw new Error(`Invalid coordinate token (not a number): ${raw}`);
    }
    // 簡易バリデーション: 日本の経緯度範囲
    if (lng < 122 || lng > 154 || lat < 20 || lat > 46) {
      throw new Error(`Coordinate out of Japan range: [${lng}, ${lat}]`);
    }
    pairs.push([lng, lat]);
  }
  return pairs;
}
