/**
 * @park-now-jp/shared - Constants
 */

import type { Prefecture } from "./types";

/**
 * 47 都道府県マスタ
 * center は地図フォーカス用（県庁所在地付近の座標）
 */
export const PREFECTURES: readonly Prefecture[] = [
  { code: "01", name: "北海道", nameRomaji: "Hokkaido", center: [141.347, 43.0642] },
  { code: "02", name: "青森県", nameRomaji: "Aomori", center: [140.74, 40.8244] },
  { code: "03", name: "岩手県", nameRomaji: "Iwate", center: [141.1527, 39.7036] },
  { code: "04", name: "宮城県", nameRomaji: "Miyagi", center: [140.8721, 38.2688] },
  { code: "05", name: "秋田県", nameRomaji: "Akita", center: [140.1024, 39.7186] },
  { code: "06", name: "山形県", nameRomaji: "Yamagata", center: [140.3633, 38.2406] },
  { code: "07", name: "福島県", nameRomaji: "Fukushima", center: [140.4675, 37.7503] },
  { code: "08", name: "茨城県", nameRomaji: "Ibaraki", center: [140.4467, 36.3418] },
  { code: "09", name: "栃木県", nameRomaji: "Tochigi", center: [139.8836, 36.5658] },
  { code: "10", name: "群馬県", nameRomaji: "Gunma", center: [139.0608, 36.3911] },
  { code: "11", name: "埼玉県", nameRomaji: "Saitama", center: [139.6489, 35.8569] },
  { code: "12", name: "千葉県", nameRomaji: "Chiba", center: [140.1233, 35.6047] },
  { code: "13", name: "東京都", nameRomaji: "Tokyo", center: [139.6917, 35.6895] },
  { code: "14", name: "神奈川県", nameRomaji: "Kanagawa", center: [139.6425, 35.4478] },
  { code: "15", name: "新潟県", nameRomaji: "Niigata", center: [139.0233, 37.9026] },
  { code: "16", name: "富山県", nameRomaji: "Toyama", center: [137.2117, 36.6953] },
  { code: "17", name: "石川県", nameRomaji: "Ishikawa", center: [136.6256, 36.5946] },
  { code: "18", name: "福井県", nameRomaji: "Fukui", center: [136.2219, 36.0652] },
  { code: "19", name: "山梨県", nameRomaji: "Yamanashi", center: [138.5683, 35.6638] },
  { code: "20", name: "長野県", nameRomaji: "Nagano", center: [138.181, 36.6513] },
  { code: "21", name: "岐阜県", nameRomaji: "Gifu", center: [136.7223, 35.3911] },
  { code: "22", name: "静岡県", nameRomaji: "Shizuoka", center: [138.3831, 34.9769] },
  { code: "23", name: "愛知県", nameRomaji: "Aichi", center: [136.9066, 35.1802] },
  { code: "24", name: "三重県", nameRomaji: "Mie", center: [136.5086, 34.7303] },
  { code: "25", name: "滋賀県", nameRomaji: "Shiga", center: [135.8686, 35.0045] },
  { code: "26", name: "京都府", nameRomaji: "Kyoto", center: [135.7556, 35.0214] },
  { code: "27", name: "大阪府", nameRomaji: "Osaka", center: [135.5023, 34.6863] },
  { code: "28", name: "兵庫県", nameRomaji: "Hyogo", center: [135.1828, 34.6913] },
  { code: "29", name: "奈良県", nameRomaji: "Nara", center: [135.8328, 34.6851] },
  { code: "30", name: "和歌山県", nameRomaji: "Wakayama", center: [135.1675, 34.226] },
  { code: "31", name: "鳥取県", nameRomaji: "Tottori", center: [134.2381, 35.5036] },
  { code: "32", name: "島根県", nameRomaji: "Shimane", center: [133.0505, 35.4723] },
  { code: "33", name: "岡山県", nameRomaji: "Okayama", center: [133.9344, 34.6618] },
  { code: "34", name: "広島県", nameRomaji: "Hiroshima", center: [132.4596, 34.3963] },
  { code: "35", name: "山口県", nameRomaji: "Yamaguchi", center: [131.4705, 34.1858] },
  { code: "36", name: "徳島県", nameRomaji: "Tokushima", center: [134.5594, 34.0658] },
  { code: "37", name: "香川県", nameRomaji: "Kagawa", center: [134.0434, 34.34] },
  { code: "38", name: "愛媛県", nameRomaji: "Ehime", center: [132.766, 33.8417] },
  { code: "39", name: "高知県", nameRomaji: "Kochi", center: [133.5311, 33.5597] },
  { code: "40", name: "福岡県", nameRomaji: "Fukuoka", center: [130.4181, 33.6064] },
  { code: "41", name: "佐賀県", nameRomaji: "Saga", center: [130.2989, 33.2494] },
  { code: "42", name: "長崎県", nameRomaji: "Nagasaki", center: [129.8737, 32.7448] },
  { code: "43", name: "熊本県", nameRomaji: "Kumamoto", center: [130.7417, 32.7898] },
  { code: "44", name: "大分県", nameRomaji: "Oita", center: [131.6126, 33.2382] },
  { code: "45", name: "宮崎県", nameRomaji: "Miyazaki", center: [131.4239, 31.9111] },
  { code: "46", name: "鹿児島県", nameRomaji: "Kagoshima", center: [130.5581, 31.5602] },
  { code: "47", name: "沖縄県", nameRomaji: "Okinawa", center: [127.6809, 26.2124] },
] as const;

export const PREFECTURE_BY_CODE = Object.fromEntries(
  PREFECTURES.map((p) => [p.code, p])
) as Record<string, Prefecture>;

/** 標準料金（参考値） */
export const STANDARD_FEES = {
  /** 普通車 60分 */
  STANDARD_HOURLY: 300,
  /** 二輪 60分 */
  MOTORCYCLE_HOURLY: 100,
} as const;

/** 標準制限時間 */
export const TIME_LIMITS = [20, 40, 60] as const;

/** UI 表示用のラベル */
export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  standard: "普通車",
  truck: "トラック",
  motorcycle: "二輪",
  senior: "高齢運転者専用",
};

export const DAY_LABELS_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;

/**
 * データソースの公式 URL（出典明記用）
 */
export const DATA_SOURCES = {
  /** 警視庁 時間制限駐車区間案内地図（メーター・チケットの主データ源） */
  mpd: {
    name: "警視庁 時間制限駐車区間案内地図",
    url: "https://parking-meter.jp/",
    termsUrl: "https://parking-meter.jp/open-data/terms",
    license: "オープンデータ利用規約準拠",
  },
  /** JARTIC（全国の交通規制データ。Phase 3 全国対応で利用予定） */
  jartic: {
    name: "公益財団法人 日本道路交通情報センター (JARTIC)",
    url: "https://www.jartic.or.jp/service/opendata/",
    license: "CC-BY 4.0",
  },
  /** 内閣府（祝日データ） */
  cabinet_office: {
    name: "内閣府",
    url: "https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html",
    license: "Public Domain",
  },
} as const;

/**
 * 必須の免責文言（変更禁止 - 一文字でも変更する場合は法務確認必須）
 */
export const DISCLAIMER_TEXT = `本アプリの情報は参考であり、実地の標識・道路標示が常に優先します。データの正確性・最新性については保証しません。駐車前に必ず現地で規制標識を確認してください。違反による罰則・損害について本アプリは一切の責任を負いません。`;
