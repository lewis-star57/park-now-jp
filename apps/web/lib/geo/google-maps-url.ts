/**
 * Google マップ経路 URL の生成ユーティリティ。
 *
 * Park Now JP のメーターは Point / LineString / MultiLineString のいずれか
 * （警視庁データは LineString が約 500 件、MultiLineString が約 250 件）。
 * UI 上の「Google マップで経路を見る」ボタンは、それぞれの geometry の
 * **代表点（中央付近）** を目的地として開く。
 *
 * GeoJSON は `[lng, lat]` 順だが、Google マップの URL は `lat,lng` 順なので
 * 入れ替えが必要。
 */

import type { LineString, MultiLineString, Point } from "geojson";

/** 経路目的地に使える GeoJSON geometry の集合 */
export type RoutableGeometry = Point | LineString | MultiLineString;

/**
 * geometry の代表点（中央付近）を `[lng, lat]` で返す。
 *
 * - Point: そのまま座標を返す
 * - LineString: 点列の中央インデックスの点
 * - MultiLineString: 全 LineString の点をフラットにして中央インデックス
 *
 * 中央点は厳密な「重心」ではなく **インデックス中央** だが、駐車区間の代表
 * としてはこれで十分（区間長は通常 50m 程度）。
 */
export function pickRepresentativeCoordinate(
  geom: RoutableGeometry
): [number, number] {
  if (geom.type === "Point") {
    // noUncheckedIndexedAccess 配下では分割代入が undefined を含むため
    // 明示的に non-null assertion で取る（GeoJSON Point は 2 要素必須）。
    const lng = geom.coordinates[0]!;
    const lat = geom.coordinates[1]!;
    return [lng, lat];
  }

  if (geom.type === "LineString") {
    const pts = geom.coordinates;
    if (pts.length === 0) {
      throw new Error("LineString has no coordinates");
    }
    const mid = pts[Math.floor(pts.length / 2)]!;
    return [mid[0]!, mid[1]!];
  }

  // MultiLineString
  const all = geom.coordinates.flat();
  if (all.length === 0) {
    throw new Error("MultiLineString has no coordinates");
  }
  const mid = all[Math.floor(all.length / 2)]!;
  return [mid[0]!, mid[1]!];
}

/**
 * `[lng, lat]` から Google マップの経路 URL を組み立てる。
 * 移動手段は車（駐車場用なので妥当）。
 */
export function googleMapsDirectionsUrl(
  coordinate: [number, number]
): string {
  const [lng, lat] = coordinate;
  // GeoJSON は [lng, lat] 順 → Google マップは "lat,lng" 順
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

/**
 * 便利ラッパー: geometry を渡すと直接 URL が返る。
 */
export function googleMapsDirectionsUrlFor(geom: RoutableGeometry): string {
  return googleMapsDirectionsUrl(pickRepresentativeCoordinate(geom));
}
