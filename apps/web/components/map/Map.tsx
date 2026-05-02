/**
 * MapLibre GL JS による地図コンポーネント
 *
 * - スタイル: CartoDB Voyager（ベクタータイル、商用OK、トークン不要）
 * - 出典: OpenStreetMap contributors © CARTO（右下に常時表示）
 * - ダーク UI に馴染ませるため、地図全体に薄い暗色オーバーレイを CSS で重ねる
 *
 * メーターは LineString / Point の両方に対応。色分けは親コンポーネントが
 * GeoJSON FeatureCollection の properties._statusLevel に "free|paid|closed"
 * を埋め込んだ状態で渡す（評価結果を MapLibre のデータ駆動スタイルで描画）。
 */

"use client";

import { useEffect, useRef } from "react";
import type { Polygon } from "geojson";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ParkingMeterCollection } from "@park-now-jp/shared";

const VOYAGER_STYLE =
  "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

// 神保町と神田の中間付近を初期表示の中心にする（10件すべてが視野に入るように）
const TOKYO_JIMBOCHO_KANDA: [number, number] = [139.7665, 35.6940];
const INITIAL_ZOOM = 14.6;

/** 現在地ボタンが flyTo するときの最低ズーム（ストリートレベル） */
const GEOLOCATE_MIN_ZOOM = 16;
/** flyTo のアニメーション時間 (ms) */
const GEOLOCATE_FLY_DURATION = 1500;

const USER_LOCATION_SOURCE = "user-location";
const USER_ACCURACY_SOURCE = "user-accuracy";

/**
 * 中心座標と半径(m)から円の Polygon を生成する。
 * 64 角形で近似。GeolocateControl の精度円と違い、地図ズームに連動して
 * 拡縮するので「円が物理的にどこを指しているか」が分かりやすい。
 */
function buildAccuracyPolygon(
  lng: number,
  lat: number,
  radiusMeters: number
): Polygon {
  const earthRadius = 6378137;
  const angularDistance = radiusMeters / earthRadius;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const segments = 64;
  const ring: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const bearing = (i / segments) * 2 * Math.PI;
    const newLat = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
        Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
    );
    const newLng =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
        Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLat)
      );
    ring.push([(newLng * 180) / Math.PI, (newLat * 180) / Math.PI]);
  }
  ring.push(ring[0]!); // close the ring
  return { type: "Polygon", coordinates: [ring] };
}

/**
 * 自作の現在地コントロール。
 *
 * MapLibre 標準の GeolocateControl は accuracy 半径を bbox にして fitBounds
 * するため、屋内で精度が悪い等の理由で関東全域までズームアウトしてしまう
 * ことがある。本クラスは accuracy を **無視**し、座標だけ使って flyTo する。
 *
 * 振る舞い:
 *  - 座標のみで flyTo
 *  - ズーム = max(現在ズーム, 16)
 *  - duration = 1500ms
 *  - ボタン押下中は disabled + 半透明
 *  - エラー時は alert
 *  - 精度円と青ドットは自前のレイヤーで描画
 */
class GeolocateButtonControl implements maplibregl.IControl {
  private _map: maplibregl.Map | null = null;
  private _container: HTMLDivElement | null = null;
  private _button: HTMLButtonElement | null = null;
  private _busy = false;

  onAdd(map: maplibregl.Map): HTMLElement {
    this._map = map;
    const container = document.createElement("div");
    container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    const button = document.createElement("button");
    button.type = "button";
    // 標準 GeolocateControl と同じクラスを付けるとアイコン CSS を流用できる
    button.className = "maplibregl-ctrl-geolocate";
    button.title = "現在地を表示";
    button.setAttribute("aria-label", "現在地を表示");
    const icon = document.createElement("span");
    icon.className = "maplibregl-ctrl-icon";
    icon.setAttribute("aria-hidden", "true");
    button.appendChild(icon);
    button.addEventListener("click", this._onClick);

    container.appendChild(button);
    this._container = container;
    this._button = button;
    return container;
  }

  onRemove(): void {
    this._button?.removeEventListener("click", this._onClick);
    this._container?.parentNode?.removeChild(this._container);
    this._map = null;
    this._container = null;
    this._button = null;
  }

  private _setBusy(busy: boolean): void {
    this._busy = busy;
    const button = this._button;
    if (!button) return;
    button.disabled = busy;
    button.style.opacity = busy ? "0.5" : "";
    button.style.cursor = busy ? "wait" : "";
  }

  private _onClick = (): void => {
    const map = this._map;
    if (!map || this._busy) return;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      window.alert("このブラウザは現在地取得に対応していません。");
      return;
    }
    // HTTPS でない・localhost でもない場合は getCurrentPosition が
    // PERMISSION_DENIED で失敗する。事前警告は出さず onError に委ねる。

    this._setBusy(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => this._onSuccess(pos),
      (err) => this._onError(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  private _onSuccess(pos: GeolocationPosition): void {
    this._setBusy(false);
    const map = this._map;
    if (!map) return;

    const { longitude, latitude, accuracy } = pos.coords;

    // 現在ズームが 16 より上ならその拡大率を維持
    const currentZoom = map.getZoom();
    const targetZoom = Math.max(currentZoom, GEOLOCATE_MIN_ZOOM);

    map.flyTo({
      center: [longitude, latitude],
      zoom: targetZoom,
      duration: GEOLOCATE_FLY_DURATION,
      essential: true, // prefers-reduced-motion でも動かす
    });

    // 精度円とドットを更新
    const accuracySource = map.getSource(USER_ACCURACY_SOURCE) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (accuracySource) {
      accuracySource.setData({
        type: "Feature",
        properties: {},
        geometry: buildAccuracyPolygon(longitude, latitude, accuracy),
      });
    }
    const dotSource = map.getSource(USER_LOCATION_SOURCE) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (dotSource) {
      dotSource.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [longitude, latitude] },
      });
    }
  }

  private _onError(err: GeolocationPositionError): void {
    this._setBusy(false);
    const message =
      err.code === err.PERMISSION_DENIED
        ? "ブラウザの位置情報の利用が拒否されています。設定から許可してください。"
        : err.code === err.POSITION_UNAVAILABLE
          ? "現在地を取得できませんでした（位置情報が利用できません）。"
          : err.code === err.TIMEOUT
            ? "現在地取得がタイムアウトしました。もう一度お試しください。"
            : "現在地を取得できませんでした。";
    window.alert(message);
  }
}

const STATUS_COLORS = {
  free: "#4ade80",
  paid: "#fbbf24",
  closed: "#f87171",
} as const;

interface MapProps {
  data: ParkingMeterCollection;
  /** 地図にマーカーをタップしたとき呼ばれる（properties.id を渡す） */
  onMeterClick: (meterId: string) => void;
}

export function Map({ data, onMeterClick }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const remountedRef = useRef(false);
  const onMeterClickRef = useRef(onMeterClick);

  useEffect(() => {
    onMeterClickRef.current = onMeterClick;
  }, [onMeterClick]);

  // 1) マップの初期化（一度だけ）
  useEffect(() => {
    // Strict Mode の re-mount はここに来る。前回の map インスタンスを再利用し、
    // cleanup の遅延破棄をキャンセルさせるためフラグだけ立てて何もしない。
    if (mapRef.current) {
      remountedRef.current = true;
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const map = new maplibregl.Map({
      container,
      style: VOYAGER_STYLE,
      center: TOKYO_JIMBOCHO_KANDA,
      zoom: INITIAL_ZOOM,
      attributionControl: false,
    });

    // 内部エラーは握りつぶさず console に出す
    map.on("error", (e) => {
      // eslint-disable-next-line no-console
      console.error("[Map] error:", e?.error ?? e);
    });

    // dynamic() の loading プレースホルダから差し替わるタイミングや
    // フォント読み込みでレイアウトがズレた直後だと、コンテナが 0×0 のまま
    // 計算されることがあるので、複数経路で resize() を呼ぶ。

    // (a) マイクロタスク後に一度
    queueMicrotask(() => {
      if (mapRef.current === map) map.resize();
    });
    // (b) load イベント発火時
    map.on("load", () => map.resize());
    // (c) コンテナサイズ変化の監視
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);

    // 注意: 組み込みの AttributionControl は使わない。
    // - スタイル内の source.attribution が customAttribution と重複する
    // - 警視庁の出典を常時表示したい
    // → 代わりに JSX 側で固定表示する。

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new GeolocateButtonControl(), "top-right");

    map.on("load", () => {
      // ────────────────────────────────────────────────────────────
      // 現在地表示用のソースとレイヤー（メーターより下に置いて重なり順を整える）
      // ────────────────────────────────────────────────────────────
      map.addSource(USER_ACCURACY_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource(USER_LOCATION_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // 精度円（半透明の青）
      map.addLayer({
        id: "user-accuracy-fill",
        type: "fill",
        source: USER_ACCURACY_SOURCE,
        paint: {
          "fill-color": "#60a5fa",
          "fill-opacity": 0.18,
        },
      });
      map.addLayer({
        id: "user-accuracy-line",
        type: "line",
        source: USER_ACCURACY_SOURCE,
        paint: {
          "line-color": "#60a5fa",
          "line-width": 1.5,
          "line-opacity": 0.6,
        },
      });

      // ドット（白縁の青円）
      map.addLayer({
        id: "user-location-dot",
        type: "circle",
        source: USER_LOCATION_SOURCE,
        paint: {
          "circle-radius": 7,
          "circle-color": "#60a5fa",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2.5,
        },
      });

      // 空のソースを準備（後段の effect で setData する）
      map.addSource("meters", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      const colorExpression: maplibregl.DataDrivenPropertyValueSpecification<string> = [
        "match",
        ["get", "_statusLevel"],
        "free",
        STATUS_COLORS.free,
        "paid",
        STATUS_COLORS.paid,
        "closed",
        STATUS_COLORS.closed,
        "#888888",
      ];

      // LineString 用 ヒットエリア（透明・広幅）
      // 細いラインをタップしやすくするための見えないクリック判定領域。
      // 実際の見た目は下の "meters-line" が担当する。
      map.addLayer({
        id: "meters-line-hit",
        type: "line",
        source: "meters",
        filter: [
          "in",
          ["geometry-type"],
          ["literal", ["LineString", "MultiLineString"]],
        ],
        paint: {
          "line-color": "#000",
          "line-opacity": 0,
          "line-width": 22,
        },
      });

      // LineString 見た目レイヤー（着色）
      map.addLayer({
        id: "meters-line",
        type: "line",
        source: "meters",
        filter: [
          "in",
          ["geometry-type"],
          ["literal", ["LineString", "MultiLineString"]],
        ],
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": colorExpression,
          "line-width": 7,
          "line-opacity": 0.95,
        },
      });

      // Point 用レイヤー（外円 = ハロー）
      map.addLayer({
        id: "meters-halo",
        type: "circle",
        source: "meters",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-color": colorExpression,
          "circle-radius": 14,
          "circle-opacity": 0.25,
        },
      });

      // Point 用レイヤー（中心円）
      map.addLayer({
        id: "meters-point",
        type: "circle",
        source: "meters",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-color": colorExpression,
          "circle-radius": 7,
          "circle-stroke-color": "#0a0e14",
          "circle-stroke-width": 2,
        },
      });

      // クリック / タップでメーター ID を親に伝える。
      // hit-area ライン → 着色ライン → ハロー → 中心点 すべてに同じハンドラを
      // 登録する。1 タップで複数レイヤーがヒットしても e.features[0] で十分。
      const handleFeatureClick = (
        e: maplibregl.MapLayerMouseEvent | maplibregl.MapLayerTouchEvent
      ) => {
        const feature = e.features?.[0];
        const id = feature?.properties?.id;
        if (typeof id === "string") {
          onMeterClickRef.current(id);
        }
      };
      const setCursorPointer = () => {
        map.getCanvas().style.cursor = "pointer";
      };
      const clearCursor = () => {
        map.getCanvas().style.cursor = "";
      };

      const tappableLayers = [
        "meters-line-hit",
        "meters-line",
        "meters-halo",
        "meters-point",
      ];
      for (const layerId of tappableLayers) {
        map.on("click", layerId, handleFeatureClick);
        map.on("mouseenter", layerId, setCursorPointer);
        map.on("mouseleave", layerId, clearCursor);
      }
    });

    mapRef.current = map;

    // React 18+ の Strict Mode は dev で effect を mount → cleanup → mount と
    // 連続呼び出しする。MapLibre は new → remove → new の高速サイクルで
    // 内部の WebGL 初期化が中断され "load" イベントが永久に発火しなくなる
    // 既知の問題がある。cleanup を microtask で遅延し、その間に再マウントが
    // 起きていれば破棄をスキップする。
    return () => {
      remountedRef.current = false;
      queueMicrotask(() => {
        if (remountedRef.current) {
          // Strict Mode の re-mount で再利用される → 破棄しない
          return;
        }
        ro.disconnect();
        map.remove();
        if (mapRef.current === map) mapRef.current = null;
      });
    };
  }, []);

  // 2) data が変わるたびにソース更新
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const source = map.getSource("meters") as maplibregl.GeoJSONSource | undefined;
      if (source) source.setData(data);
    };

    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once("load", apply);
    }
  }, [data]);

  // container には inline style で 100%/100% を必ず持たせる（Tailwind の
  // クラス計算ずれや preflight 影響を避ける保険）。
  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      {/* ダーク UI に馴染ませる薄いオーバーレイ（地図のクリックは透過） */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(10,14,20,0.18), rgba(10,14,20,0.05) 40%, rgba(10,14,20,0))",
        }}
      />
      {/*
       * Attribution（地図右下、常時表示）
       * - OSM, CARTO は地図ベースタイルの利用規約で必須
       * - 警視庁は本アプリのデータ提供元（parking-meter.jp）で出典明記が必要
       * - リンクは a タグ、地図のクリックを邪魔しないよう pointer-events を制御
       */}
      <div className="absolute bottom-1 right-1 z-10 px-2 py-1 rounded bg-bg-elev/85 border border-line/60 backdrop-blur text-[10px] text-text-dim leading-tight pointer-events-auto">
        ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-text underline-offset-2 hover:underline"
        >
          OpenStreetMap
        </a>{" "}
        contributors ©{" "}
        <a
          href="https://carto.com/attributions"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-text underline-offset-2 hover:underline"
        >
          CARTO
        </a>{" "}
        ©{" "}
        <a
          href="https://parking-meter.jp/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-text underline-offset-2 hover:underline"
        >
          警視庁
        </a>
      </div>
    </>
  );
}
