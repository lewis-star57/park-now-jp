/**
 * JARTIC 生レコードをアプリ用 GeoJSON に変換するモジュール
 *
 * 入力: JarticRawRecord[]（規制種別=72 でフィルタ済みを想定）
 * 出力: ParkingMeterCollection（都道府県ごとの GeoJSON FeatureCollection）
 *
 * 同位置の他規制（規制種別=22 駐禁等）も統合し、
 * overlappingRegulations フィールドに格納する。
 */

import type {
  Feature,
  LineString,
} from "geojson";
import type {
  JarticRawRecord,
  ParkingMeter,
  ParkingMeterCollection,
  ParkingMeterFeature,
  PrefectureCode,
} from "@park-now-jp/shared";
import { RegulationCode } from "@park-now-jp/shared";
import { parseCoordinates } from "./fetch-jartic";

// ============================================================================
// 公開関数
// ============================================================================

/**
 * 規制種別 72 の生レコードを ParkingMeter に変換
 */
export function recordToParkingMeter(
  record: JarticRawRecord,
  prefCode: PrefectureCode
): ParkingMeter | null {
  if (record.regulationCode !== RegulationCode.TIMED_PARKING) {
    return null;
  }

  const details = record.details ?? {};

  // TODO: JARTIC データの実際のフィールド名を確認して埋める
  // 現状は雛形なのでサンプル値が多い
  const meter: ParkingMeter = {
    id: `${prefCode}_${record.uniqueKey}`,
    prefCode,
    policeStationCode: record.policeStationCode,
    name: extractName(details),
    address: extractAddress(details),
    spaces: parseNumber(details.spaces) ?? null,
    timeLimitMinutes: parseNumber(details.timeLimit) ?? 60,
    feeYen: parseNumber(details.fee) ?? 300,
    vehicleType: detectVehicleType(details),
    operatingHours: parseOperatingHours(details),
    operatingDays: parseOperatingDays(details),
    exclusions: parseExclusions(details),
    overlappingRegulations: [], // 後段で統合
    lastUpdated: new Date().toISOString().split("T")[0],
  };

  return meter;
}

/**
 * 規制種別 72 のレコード群と、同位置の他の規制（駐禁等）を結合し、
 * GeoJSON FeatureCollection として返す。
 */
export function buildGeoJsonForPrefecture(
  meterRecords: JarticRawRecord[],
  otherRegulations: JarticRawRecord[],
  prefCode: PrefectureCode
): ParkingMeterCollection {
  const features: ParkingMeterFeature[] = [];

  for (const record of meterRecords) {
    const meter = recordToParkingMeter(record, prefCode);
    if (!meter) continue;

    let coords: [number, number][];
    try {
      coords = parseCoordinates(record.coordinates);
    } catch (err) {
      console.warn(`Skipping record ${meter.id}: ${(err as Error).message}`);
      continue;
    }
    if (coords.length === 0) continue;

    // 同位置の他の規制を検出（簡易: 座標が近いもの）
    meter.overlappingRegulations = findOverlapping(coords, otherRegulations);

    const geometry: LineString =
      coords.length >= 2
        ? { type: "LineString", coordinates: coords }
        : { type: "LineString", coordinates: [coords[0], coords[0]] };

    const feature: Feature<LineString, ParkingMeter> = {
      type: "Feature",
      properties: meter,
      geometry,
    };
    features.push(feature as ParkingMeterFeature);
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

function extractName(details: Record<string, string | number>): string | undefined {
  // TODO: JARTIC の実フィールド名に合わせる
  return (details.name as string) ?? undefined;
}

function extractAddress(details: Record<string, string | number>): string | undefined {
  return (details.address as string) ?? undefined;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function detectVehicleType(details: Record<string, string | number>): ParkingMeter["vehicleType"] {
  // TODO: 実フィールドから判定
  const v = String(details.vehicleType ?? "").toLowerCase();
  if (v.includes("二輪") || v.includes("motorcycle")) return "motorcycle";
  if (v.includes("トラック") || v.includes("truck")) return "truck";
  if (v.includes("高齢")) return "senior";
  return "standard";
}

function parseOperatingHours(details: Record<string, string | number>): ParkingMeter["operatingHours"] {
  // TODO: "09:00-19:00" のような形式をパース
  const raw = String(details.operatingHours ?? "09:00-19:00");
  return raw.split(",").map((part) => {
    const [start, end] = part.trim().split("-");
    return { startTime: start, endTime: end };
  });
}

function parseOperatingDays(details: Record<string, string | number>): ParkingMeter["operatingDays"] {
  // TODO: 実データの曜日表現に合わせる
  const raw = String(details.operatingDays ?? "");
  if (!raw || raw === "全曜日") return [];
  // 簡易実装
  const map: Record<string, number> = { 日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6 };
  return raw
    .split("")
    .filter((c) => c in map)
    .map((c) => map[c] as 0 | 1 | 2 | 3 | 4 | 5 | 6);
}

function parseExclusions(details: Record<string, string | number>): ParkingMeter["exclusions"] {
  const raw = String(details.exclusions ?? "");
  const exclusions: ParkingMeter["exclusions"] = [];
  if (raw.includes("祝") || raw.includes("休日")) exclusions.push("holidays");
  if (raw.includes("日曜")) exclusions.push("sundays");
  if (raw.includes("土曜")) exclusions.push("saturdays");
  return exclusions;
}

/**
 * 指定座標群と重なる他の規制を検出する。
 * 距離閾値: 約20m以内（緯度経度で約 0.0002 度）
 */
function findOverlapping(
  meterCoords: [number, number][],
  otherRegulations: JarticRawRecord[]
): ParkingMeter["overlappingRegulations"] {
  const overlapping: ParkingMeter["overlappingRegulations"] = [];
  const THRESHOLD = 0.0002;

  for (const reg of otherRegulations) {
    let regCoords: [number, number][];
    try {
      regCoords = parseCoordinates(reg.coordinates);
    } catch {
      continue;
    }
    const isNearby = meterCoords.some(([mLng, mLat]) =>
      regCoords.some(
        ([rLng, rLat]) =>
          Math.abs(mLng - rLng) < THRESHOLD && Math.abs(mLat - rLat) < THRESHOLD
      )
    );
    if (!isNearby) continue;

    overlapping.push({
      code: reg.regulationCode as 21 | 22 | 72 | 73,
      description: String(reg.details?.description ?? `規制種別 ${reg.regulationCode}`),
      isAllDay: !reg.details?.operatingHours,
    });
  }

  return overlapping;
}
