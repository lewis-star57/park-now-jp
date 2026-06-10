# 警視庁オープンデータ スナップショット（出所保全）

このディレクトリは、本アプリの東京データ（`apps/web/public/data/13.geojson`）の取得元である
警視庁「時間制限駐車区間案内地図」（https://parking-meter.jp/）の**生データを取得時点のまま**保存したものです。

## なぜ保存するか

- 提供サイトは 2026年3月31日〜4月末頃、「新サービス構築のため」**実際に公開を一時停止した実績がある**（その後再開）。
  再び供給が止まっても、アプリのデータの出所と内容を再現・検証できるようにする。
- 変換済みデータ（13.geojson）の元になった一次データを保全し、加工の正当性をいつでも検証可能にする。

## 出典・ライセンス

- 出典: **警視庁 時間制限駐車区間案内地図** https://parking-meter.jp/
- 利用規約: https://parking-meter.jp/open-data/terms （オープンデータ利用規約準拠・出典明記）

## スナップショット一覧

| ディレクトリ | データ基準日 | 取得日 | 件数 | 検証 |
|---|---|---|---|---|
| `2025-10-01/` | 2025-10-01 | 2026-06-10 | 752（メーター634+チケット118） | アプリの 13.geojson と識別IDで752/752件突合・属性不一致0件 |

データ基準日は配布 KML 内のファイル名（例: `20251001_parkingmeter.kml`）に由来します。
ダウンロードページの「最終更新日」（2026-04-01）はサイト再構築時の再公開日であり、データ実体の基準日ではない点に注意。

## ファイルと SHA-256 ハッシュ（2025-10-01 スナップショット）

| ファイル | 取得元 URL | SHA-256 |
|---|---|---|
| `parkingmeter.geojson` | `/parkingmeter.geojson` | `be93c5835c76057dce930390e8118334091f983a154ebae9add35cef9d161108` |
| `parkingmeter.kml.zip` | `/parkingmeter.kml.zip` | `4fa68ac1ecbda7e918533390463ff929bc3fdd2bb58e83e0e7b24864fb3cfb2a` |
| `parkingmeter_attr.csv` | `/parkingmeter_attr.csv` | `26a38f1335241e6afa76c9bfe2d64c97d2a9130c27687213040f184a46348b94` |

※ `/parkingmeter.geojson.zip` はダウンロードページに掲載されているが 404（2026-06-10 時点・新サイトの不具合）。
※ 最新スナップショットの `parkingmeter.geojson` は、死活監視ワークフローのハッシュ比較の基準としても使われる。

## 更新手順（監視ワークフローが変更を検知したら）

1. 以下の3ファイルを取得する
   - https://parking-meter.jp/parkingmeter.geojson
   - https://parking-meter.jp/parkingmeter.kml.zip
   - https://parking-meter.jp/parkingmeter_attr.csv
2. KML zip 内のファイル名（`YYYYMMDD_parkingmeter.kml`）から新しい**データ基準日**を確認する
3. `data-sources/mpd/<新しい基準日>/` に3ファイルを保存し、この README の一覧表とハッシュ表を更新する
4. アプリ用データ `apps/web/public/data/13.geojson` を変換・更新する
   （Phase 1 では手動変換。TODO: data-pipeline に MPD 変換スクリプトを実装）
5. `apps/web/lib/data-sources/mpd-meta.json` の `snapshotDate` / `fetchedAt` を更新する
6. PR を作成し、件数が極端に増減していないかレビューする

## 関連

- 死活監視: `.github/workflows/monitor-mpd.yml`（毎月5日 10:00 JST に自動実行）
- アプリ内の基準日表示: `apps/web/lib/data-sources/mpd-meta.json`
