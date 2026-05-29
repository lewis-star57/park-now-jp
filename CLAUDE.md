# CLAUDE.md — Park Now JP プロジェクト指示書

このファイルは Claude Code（または他の AI コーディングアシスタント）がプロジェクトを理解するためのものです。**作業開始前に必ず最後まで読んでください。**

---

## 🎯 プロジェクトの目的

**Park Now JP** は、日本全国のパーキングメーター（時間制限駐車区間）を「**今この瞬間、無料・有料・駐車不可のどれか**」がひと目で分かる PWA です。

### 解決する課題
- 公式の警視庁 `parking-meter.jp` はオープンデータ（GeoJSON/KML/CSV）を公開していて出典として優秀だが、規制内容を地図に表示するだけで「**今この瞬間に停められるか**」は判定しない（＝本アプリの主データ源かつ差別化点）
- 既存サービスは「メーターが止まる時間」を表示するだけで「**今まさに停められるか**」を判定しない
- 「メーター停止中だが駐車禁止標識で実は停められない」というトラップを警告するサービスがない
- スマホ向けに最適化された UX が乏しい

### 提供する価値
1. **現在時刻 × 規制情報 × 祝日判定** の三段階で「今すぐ停まれる」かを判定
2. **規制種別 72（時間制限駐車区間）と他の駐車禁止規制の重複**を検出して警告
3. **PWA** でオフライン動作・ホーム画面追加可能
4. **全国対応（ロードマップ）**: Phase 1 は東京（警視庁 `parking-meter.jp` のオープンデータ）。全国は JARTIC オープンデータ経由で拡張予定

---

## 🏗 技術スタック

| 領域 | 採用技術 | 理由 |
|---|---|---|
| フレームワーク | Next.js 15 (App Router) | RSC + PWA 対応、静的エクスポート (`output: 'export'`) 対応 |
| 言語 | TypeScript (`strict: true`) | 型安全。`any` 禁止 |
| スタイリング | Tailwind CSS v4 + shadcn/ui | デザイン一貫性、CSS variables ベース |
| 地図 | MapLibre GL JS | OSS、Mapbox トークン不要、PWA 親和性高 |
| タイル | CartoDB Voyager (ベクター) / OSM | API キー不要・商用OK、Mapbox 非依存 |
| 状態管理 | Zustand | 軽量、persist middleware で IndexedDB 連携 |
| ローカル DB | Dexie.js (IndexedDB) | お気に入り・履歴・データキャッシュ |
| PWA | Serwist (`@serwist/next`) | next-pwa の後継、Workbox ベース |
| データ取得 | GitHub Actions + Node スクリプト | 月次自動更新。Phase 1 は警視庁 `parking-meter.jp`、全国対応で JARTIC |
| ホスティング | VPS + Nginx | Next.js 静的エクスポート (`out/`) を Nginx で配信 |
| データ配信 | 静的 JSON (Nginx・同一オリジン) | `public/data/{pref}.geojson` |
| パッケージ管理 | pnpm workspaces | monorepo 構成 |

### 採用しない技術と理由
- **Mapbox GL JS**: 商用 API キー必須、コスト発生リスク
- **Google Maps**: 高額、無料枠少ない
- **next-pwa**: メンテナンス停滞、Serwist が後継として推奨されている
- **Redux**: オーバースペック

---

## 📁 ディレクトリ構造

```
park-now-jp/
├── CLAUDE.md                       # ← このファイル
├── README.md                       # プロジェクト紹介
├── LICENSE                         # MIT
├── package.json                    # root, pnpm workspaces 定義
├── pnpm-workspace.yaml
├── tsconfig.base.json
│
├── apps/
│   └── web/                        # Next.js PWA
│       ├── app/                    # App Router
│       │   ├── layout.tsx
│       │   ├── page.tsx            # メインの地図画面
│       │   ├── manifest.ts         # PWA manifest
│       │   ├── about/page.tsx      # 利用規約・出典
│       │   └── api/                # API routes（必要なら）
│       ├── components/
│       │   ├── map/                # MapLibre 関連
│       │   ├── sheet/              # ボトムシート
│       │   ├── filters/            # フィルターチップ
│       │   └── ui/                 # shadcn/ui ベースの atomic components
│       ├── lib/
│       │   ├── parking/
│       │   │   ├── status.ts       # 「今停まれるか」判定の核
│       │   │   ├── status.test.ts
│       │   │   └── types.ts        # apps/web 固有の型
│       │   ├── holidays/
│       │   │   ├── index.ts        # 祝日判定 (内閣府データ同梱)
│       │   │   └── data.json       # ビルド時に packages/data-pipeline が生成
│       │   ├── geo/
│       │   │   ├── distance.ts     # 距離計算 (Haversine)
│       │   │   └── bbox.ts         # bounding box ユーティリティ
│       │   ├── store/
│       │   │   ├── meters.ts       # Zustand: メーターデータ
│       │   │   ├── filters.ts      # Zustand: 表示フィルター
│       │   │   └── favorites.ts    # Zustand + IndexedDB persist
│       │   └── db/
│       │       └── dexie.ts        # IndexedDB スキーマ
│       ├── public/
│       │   ├── icons/              # PWA icons (72/96/128/...512)
│       │   └── data/               # 都道府県別 GeoJSON
│       ├── next.config.ts          # Serwist + i18n 設定
│       └── package.json
│
├── packages/
│   ├── shared/                     # 共通の型・ロジック
│   │   ├── src/
│   │   │   ├── types.ts            # ParkingMeter, MeterStatus 等
│   │   │   ├── constants.ts        # 規制種別コード等
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── data-pipeline/              # JARTIC データ取得・変換
│       ├── src/
│       │   ├── fetch-jartic.ts     # JARTIC からダウンロード
│       │   ├── parse-csv.ts        # CSV パース (Shift_JIS 注意)
│       │   ├── extract-meters.ts   # 規制種別 72 を抽出
│       │   ├── to-geojson.ts       # GeoJSON 変換
│       │   ├── split-by-pref.ts    # 都道府県別分割
│       │   ├── fetch-holidays.ts   # 内閣府 syukujitsu.csv 取得
│       │   └── index.ts            # CLI エントリポイント
│       └── package.json
│
├── .github/
│   └── workflows/
│       ├── update-data.yml         # 月次データ更新（毎月3日 09:00 JST）
│       └── ci.yml                  # PR 時のテスト・型チェック
│
└── docs/
    ├── DATA_SCHEMA.md              # JARTIC データの中身解説
    ├── STATUS_LOGIC.md             # 「今停まれるか」判定の数学
    └── DISCLAIMER.md               # 法務免責事項
```

---

## 🧭 開発ルール（厳守）

### コード品質
- **TypeScript `strict: true` 必須**。`any` は禁止、必要なら `unknown` から narrowing
- ESLint + Prettier、pre-commit hook で自動整形
- 関数には JSDoc コメント。**特に「今停まれるか」判定ロジックには必ずコメントで根拠（標識・規制）を記載**
- ファイル末尾に必ず改行
- import 順: 標準ライブラリ → 外部 → `@park-now-jp/shared` → 相対パス

### Git / コミット
- ブランチ命名: `feat/xxx`, `fix/xxx`, `chore/xxx`, `docs/xxx`
- コミットメッセージ: [Conventional Commits](https://www.conventionalcommits.org/) 準拠
  - `feat: 現在地ボタンを追加`
  - `fix(status): 祝日深夜帯の判定ミスを修正`
- main ブランチへの直接 push 禁止、PR 経由のみ
- PR テンプレートに「実地確認したか」チェック欄を含める

### 重要な実装方針
1. **ステータス判定は純粋関数で書く**（`(meter, datetime, holidays) => Status`）。Date.now() を直接呼ばない。テスト容易性のため
2. **タイムゾーンは必ず Asia/Tokyo を明示**。`new Date()` を直接信用しない、`date-fns-tz` を使用
3. **データはビルド時に静的化**。ランタイム fetch は最小限。PWA でオフライン動作するのが前提
4. **個人情報・位置情報を一切サーバーに送らない**。位置情報は端末内処理のみ
5. **フィーチャーフラグ**: 新機能は `lib/flags.ts` でトグル可能に

### テスト
- ステータス判定 (`lib/parking/status.ts`) は **vitest で網羅的に**
  - 平日昼間（メーター稼働中）
  - 平日夜間（メーター停止 + 駐車禁止規制次第）
  - 土曜日（地域による）
  - 日曜祝日（緑線は無料、青線は稼働）
  - 24時間駐車禁止エリア（メーター停止中も駐車不可）
  - 境界値（メーター開始・終了時刻ちょうど）
- E2E は Playwright を後付けで（MVP では不要）

---

## 📊 データフロー

> ⚠️ 下図は**全国対応（Phase 3）を見据えた JARTIC パイプライン構想**です。**Phase 1（現在の東京）の実データは警視庁 `parking-meter.jp`** のオープンデータを使用し、配信は **VPS + Nginx**（静的エクスポート）です。

```
[JARTIC オープンデータ]
   (毎月月初に CSV で公開、規制種別103種別)
        │
        ▼
[GitHub Actions: update-data.yml]
   (毎月3日 09:00 JST に自動実行)
        │
        ├─ 1. fetch-jartic.ts   : JARTIC から ZIP ダウンロード
        ├─ 2. parse-csv.ts      : Shift_JIS CSV パース、緯度経度のスペース区切りを分解
        ├─ 3. extract-meters.ts : 規制種別コード = 72 だけ抽出
        ├─ 4. to-geojson.ts     : GeoJSON FeatureCollection 化
        ├─ 5. split-by-pref.ts  : 都道府県別に分割（バンドルサイズ対策）
        └─ 6. fetch-holidays.ts : 内閣府 syukujitsu.csv → JSON 化
        │
        ▼
[apps/web/public/data/{pref-code}.geojson]
[apps/web/lib/holidays/data.json]
        │
        ▼
[ビルド（静的エクスポート out/） → VPS + Nginx で配信]
        │
        ▼
[クライアント PWA]
   (現在地に近い都道府県の GeoJSON のみ取得 → IndexedDB キャッシュ)
```

### 重要な制約
- JARTIC データは**毎月月初に更新され、前月分は取得不可**になる → GitHub Actions で必ず取得＆コミット
- データには**全 103 種別**が含まれるが、本プロジェクトで使うのは規制種別 = `72`（時間制限駐車区間）のみ
- 緯度経度は CSV 内で**スペース区切り複数値**として格納されている（例: `139.75425 35.18992 139.75500 35.19000`）→ パース時に分解必要
- 文字コードは **Shift_JIS**

---

## ⚖️ 法務・免責（必須記載事項）

### ライセンス
- 本プロジェクト: **MIT License**
- データ（Phase 1・東京）: 警視庁 時間制限駐車区間案内地図（`parking-meter.jp`、オープンデータ利用規約準拠）→ アプリ内・README で必ず出典明記
- データ（全国対応・Phase 3 予定）: JARTIC 交通規制情報 (CC-BY 4.0)
- 地図: © OpenStreetMap contributors / © CARTO

### 必須の出典文言（現行・東京）
```
データ提供：警視庁 時間制限駐車区間案内地図
出典: https://parking-meter.jp/
```

### 必須の免責文言（アプリ内で常時表示）
```
⚠ 本アプリの情報は参考であり、実地の標識・道路標示が常に優先します。
データの正確性・最新性については保証しません。駐車前に必ず現地で
規制標識を確認してください。違反による罰則・損害について本アプリは
一切の責任を負いません。
```

この警告は以下の箇所に必ず表示：
- 各メーター詳細画面の下部
- 初回起動時のオンボーディング
- README、利用規約ページ

---

## 🚀 開発の進め方（推奨フェーズ）

### Phase 1: MVP（東京限定、ローカル動作）
- [ ] monorepo セットアップ (pnpm workspaces)
- [ ] `packages/shared/src/types.ts` 完成
- [ ] `packages/data-pipeline` で東京の駐車メーターデータ（警視庁 `parking-meter.jp`）を取得して GeoJSON 化
- [ ] `apps/web` で MapLibre 地図表示 + サンプルデータ読み込み
- [ ] `lib/parking/status.ts` 実装 + vitest で網羅テスト
- [ ] フィルター UI（「今すぐ無料」など）
- [ ] ボトムシート（詳細表示）
- [ ] 免責ダイアログ

### Phase 2: PWA 化 + オフライン
- [ ] Serwist で Service Worker 設定
- [ ] manifest.ts、アイコン群作成
- [ ] IndexedDB（Dexie）でお気に入り・履歴・地図タイルキャッシュ
- [ ] 「ホーム画面に追加」プロンプト

### Phase 3: 全国対応
- [ ] GitHub Actions による月次データ自動取得
- [ ] 都道府県別 GeoJSON 分割と動的ロード
- [ ] 現在地ベースで「近県のみ」取得する戦略

### Phase 4: 通知・高度機能
- [ ] Web Push 通知（駐車時間切れアラート）
- [ ] 駐車履歴・統計
- [ ] お気に入りスポットの状態変化通知
- [ ] 「他の駐車禁止規制との重複」警告ロジック強化

---

## 📌 ペルソナ・利用シーン

ターゲット: **東京都心で車を使うビジネスパーソン・配達員・営業職**

利用シーンの例:
1. 「今、神保町で30分だけ打ち合わせ。**今すぐ無料で停められる場所**は？」
2. 「日曜の朝、銀座でブランチ。**日祝で稼働停止のメーター**を探したい」
3. 「事前に行く先を決めて、**お気に入り登録**しておく」
4. 「メーターに停めた → **時間切れ前に通知**してほしい」

UX 設計の根幹: **3秒ルール** = 起動から「今停まれる場所」が3秒以内に視認できる

---

## 🐛 既知の難所・実装上の罠

1. **JARTIC データの緯度経度フォーマット**
   - 1セルに複数の経緯度がスペース区切りで入る
   - LineString として処理する必要あり（駐車区間は線で表される）

2. **「メーター停止 ≠ 駐車可」のトラップ**
   - 規制種別 72（時間制限駐車）の時間外でも、規制種別 22（駐車禁止）が重複している場所では駐車不可
   - 同じ位置の他の規制を必ずチェックしてから「無料」表示する

3. **タイムゾーン**
   - JARTIC の時刻表記はローカル時間（Asia/Tokyo）
   - 実行環境（ブラウザ・CI）のタイムゾーンは不定なので、必ず `date-fns-tz` で Asia/Tokyo を明示

4. **祝日判定**
   - 振替休日・国民の休日・特別休日（オリンピック開会式等）まで考慮
   - 内閣府の syukujitsu.csv はこれら全部含む

5. **PWA の Service Worker 更新**
   - データ更新時にユーザーが古いキャッシュを使わないよう、versioning 戦略を Serwist で設定

---

## 📞 質問・判断に迷ったとき

判断に迷う実装が出たら以下を優先:
1. **ユーザー安全 > UX > 機能数 > 開発速度**
2. 「警告すべき情報を見逃させない」 > 「画面をシンプルに保つ」
3. 「実装が複雑になる」と感じたら、まず `docs/` に設計メモを書いてから実装

困ったら docs/ 内のドキュメントを更新しながら進めること。クロちゃん（Claude）は基本的に積極的に動いてOK。

---

最終更新: 2026年5月
