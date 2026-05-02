/**
 * @park-now-jp/shared - Type Definitions
 *
 * このファイルはプロジェクトの「契約」です。
 * apps/web と packages/data-pipeline の両方が依存します。
 * 変更時はパイプライン側とアプリ側の両方の影響を確認してください。
 */

// ============================================================================
// 1. JARTIC 規制種別コード（抜粋・本プロジェクトで使うもののみ）
// ============================================================================

/** JARTIC 規制種別コード */
export const RegulationCode = {
  /** 時間制限駐車区間（パーキングメーター） */
  TIMED_PARKING: 72,
  /** 駐車禁止 */
  NO_PARKING: 22,
  /** 駐停車禁止 */
  NO_STOPPING: 21,
  /** 高齢運転者等専用駐車区間 */
  SENIOR_ONLY_PARKING: 73,
} as const;

export type RegulationCodeValue = (typeof RegulationCode)[keyof typeof RegulationCode];

// ============================================================================
// 2. 都道府県
// ============================================================================

export type PrefectureCode =
  | "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10"
  | "11" | "12" | "13" | "14" | "15" | "16" | "17" | "18" | "19" | "20"
  | "21" | "22" | "23" | "24" | "25" | "26" | "27" | "28" | "29" | "30"
  | "31" | "32" | "33" | "34" | "35" | "36" | "37" | "38" | "39" | "40"
  | "41" | "42" | "43" | "44" | "45" | "46" | "47";

export interface Prefecture {
  code: PrefectureCode;
  name: string;
  nameRomaji: string;
  /** 中心座標（フォーカス用） */
  center: [number, number]; // [lng, lat]
}

// ============================================================================
// 3. 駐車メーター（時間制限駐車区間）
// ============================================================================

/**
 * パーキングメーター区間の生データ。
 * GeoJSON Feature の properties に格納される。
 */
export interface ParkingMeter {
  /** ユニーク ID（例: "13_3000123" = 都道府県コード_ユニークキー） */
  id: string;

  /** 都道府県コード */
  prefCode: PrefectureCode;

  /** 警察署コード */
  policeStationCode: string;

  /** 区間名（推定または近隣の住所等） */
  name?: string;

  /** 住所（推定） */
  address?: string;

  /** 駐車可能台数 */
  spaces: number | null;

  /** 制限時間（分） — 通常 20, 40, 60 */
  timeLimitMinutes: number;

  /** 料金（円） */
  feeYen: number;

  /** 対象車種 */
  vehicleType: VehicleType;

  /** 稼働時間帯のリスト（複数あり得る） */
  operatingHours: OperatingHour[];

  /** 適用曜日（複数指定可。空配列なら全曜日） */
  operatingDays: DayOfWeek[];

  /** 適用除外日（祝日除外フラグ等） */
  exclusions: Exclusion[];

  /** 同位置の他の規制（駐禁規制との重複検出用） */
  overlappingRegulations: OverlappingRegulation[];

  /** データの最終更新日（YYYY-MM-DD） */
  lastUpdated: string;

  // --------------------------------------------------------------------------
  // 警視庁オープンデータの追加フィールド（オプショナル）
  //
  // データパイプラインが警視庁データを変換した際に付与される。
  // 既存の正規化済みフィールド（vehicleType, operatingHours など）と冗長になる
  // ことがあるが、UI 表示時は元データの文言をそのまま見せる方が情報量が多い
  // ため両方残す。
  // --------------------------------------------------------------------------

  /** 種別（パーキング・メーター / パーキング・チケット） */
  category?: "パーキング・メーター" | "パーキング・チケット";

  /** 制限事項1 の生テキスト（例: "日曜・休日を除く"） */
  restriction1?: string;

  /** 制限事項2 の生テキスト（例: "１月１日〜３日を除く"） */
  restriction2?: string;

  /** 普通車対応 */
  supportsStandard?: boolean;

  /** 貨物用対応 */
  supportsTruck?: boolean;

  /** 二輪車対応 */
  supportsMotorcycle?: boolean;

  /** 高齢運転者標章車専用 */
  supportsSenior?: boolean;
}

export type VehicleType =
  | "standard"   // 普通車
  | "truck"      // トラック
  | "motorcycle" // 二輪
  | "senior";    // 高齢運転者等専用

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=日曜, 6=土曜

export interface OperatingHour {
  /** 開始時刻 "HH:MM" */
  startTime: string;
  /** 終了時刻 "HH:MM" */
  endTime: string;
}

export type Exclusion =
  | "holidays"   // 祝日除外
  | "saturdays"  // 土曜除外
  | "sundays";   // 日曜除外

export interface OverlappingRegulation {
  /** 規制種別コード */
  code: RegulationCodeValue;
  /** 規制内容（解説テキスト） */
  description: string;
  /** 適用時間帯（あれば） */
  operatingHours?: OperatingHour[];
  /** 適用曜日 */
  operatingDays?: DayOfWeek[];
  /** 終日適用かどうか */
  isAllDay: boolean;
}

// ============================================================================
// 4. ステータス判定の入出力
// ============================================================================

/**
 * メーターの「今この瞬間」のステータス。
 * UI のマーカー色は level に直結する。
 */
export interface MeterStatus {
  /** ステータスレベル */
  level: StatusLevel;

  /** 短い見出し（例: "今 無料", "稼働中"） */
  label: string;

  /** メイン説明（例: "60分 ¥300"） */
  message: string;

  /** 詳細説明（カードに表示） */
  detail: string;

  /** 警告メッセージ（駐禁規制との重複等） */
  warning?: string;

  /** ステータスが変わる次の時刻（あれば、UTC ISO 文字列） */
  nextChangeAt?: string;
}

export type StatusLevel =
  | "free"     // 緑: 今 無料で停められる
  | "paid"     // 黄: 有料稼働中
  | "closed";  // 赤: 駐車不可

/**
 * ステータス判定関数のシグネチャ。
 * 純粋関数として実装すること（Date.now() 等の副作用禁止）。
 */
export type StatusEvaluator = (
  meter: ParkingMeter,
  now: Date,
  isHoliday: (date: Date) => boolean
) => MeterStatus;

// ============================================================================
// 5. GeoJSON 拡張型
// ============================================================================

import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  Point,
} from "geojson";

/**
 * メーター区間 = LineString / MultiLineString / Point のいずれか
 * - LineString: 単一の駐車区間（路上の連続区域）
 * - MultiLineString: 複数の連結 / 並列区間（警視庁データに約 1/3 含まれる）
 * - Point: 1 点表現（小規模な区間や二輪専用枠など）
 */
export type ParkingMeterGeometry = LineString | MultiLineString | Point;

export type ParkingMeterFeature = Feature<ParkingMeterGeometry, ParkingMeter>;

export type ParkingMeterCollection = FeatureCollection<
  ParkingMeterGeometry,
  ParkingMeter
>;

// ============================================================================
// 6. アプリケーション状態
// ============================================================================

export interface FilterState {
  /** ステータスでフィルター */
  freeNow: boolean;
  /** 制限時間 */
  timeLimit: 20 | 40 | 60 | null;
  /** 車種 */
  vehicleType: VehicleType | null;
  /** 高齢運転者専用のみ */
  seniorOnly: boolean;
}

export interface FavoriteMeter {
  meterId: string;
  prefCode: PrefectureCode;
  name: string;
  /** 登録日時（ISO） */
  createdAt: string;
  /** 任意のメモ */
  note?: string;
}

export interface ParkingHistoryEntry {
  meterId: string;
  prefCode: PrefectureCode;
  /** 駐車開始時刻 */
  startedAt: string;
  /** 駐車終了予定時刻（リマインダー用） */
  expiresAt: string;
  /** 実際の駐車終了時刻 */
  endedAt?: string;
  /** メモ */
  note?: string;
}

// ============================================================================
// 7. データパイプラインの型
// ============================================================================

/**
 * JARTIC CSV の生レコード（103種別フォーマット）。
 * Shift_JIS から UTF-8 に変換済みの状態を想定。
 */
export interface JarticRawRecord {
  /** 都道府県コード（2桁） */
  prefCode: string;
  /** 警察署コード */
  policeStationCode: string;
  /** 共通規制種別コード */
  regulationCode: number;
  /** 規制決定年月日（YYYY/M/D） */
  decisionDate: string;
  /** 都道府県別ユニークキー */
  uniqueKey: string;
  /** 規制場所の経度緯度（スペース区切り。ペアで複数あり） */
  coordinates: string;
  /** 規制内容詳細 */
  details?: Record<string, string | number>;
}

export interface PipelineConfig {
  /** 取得対象の都道府県（空配列で全国） */
  targetPrefectures: PrefectureCode[];
  /** 出力ディレクトリ */
  outputDir: string;
  /** JARTIC 公開データ URL */
  jarticDataUrl: string;
  /** 内閣府祝日データ URL */
  holidaysDataUrl: string;
}

// ============================================================================
// 8. 祝日データ
// ============================================================================

export interface Holiday {
  /** YYYY-MM-DD */
  date: string;
  /** 祝日名（例: "元日"） */
  name: string;
}

// ============================================================================
// 9. 定数
// ============================================================================

/** タイムゾーン（必ず Asia/Tokyo を使用） */
export const TIMEZONE = "Asia/Tokyo";

/** GeoJSON データのバージョン（破壊的変更時にインクリメント） */
export const DATA_SCHEMA_VERSION = 1;

/** PWA キャッシュ名のプレフィックス */
export const CACHE_PREFIX = "park-now-jp";
