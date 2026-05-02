# JARTIC データスキーマ解説

> 公益財団法人日本道路交通情報センター (JARTIC) が提供する「交通規制情報（103種別）」の構造解説。
> このドキュメントは Claude Code がデータパイプラインを実装する際の参照資料です。

## 概要

- **提供元**: JARTIC https://www.jartic.or.jp/service/opendata/
- **ライセンス**: CC-BY 4.0
- **更新頻度**: 月次（毎月月初）
- **形式**: ZIP（中身は CSV）
- **文字コード**: Shift_JIS
- **特徴**: 前月分は更新時に取得不可になる → 自前でアーカイブ必須

## CSV カラム構成（標準フォーマット）

```
都道府県コード,警察署コード,共通規制種別コード,規制決定年月日,都道府県別ユニークキー,規制場所の経度緯度,...（規制種別ごとの詳細）
```

| カラム | 型 | 説明 | 例 |
|---|---|---|---|
| 都道府県コード | string(2) | 全国地方公共団体コード | "13" (東京都) |
| 警察署コード | string | 警察署を識別するコード | "100" |
| 共通規制種別コード | number | **本プロジェクトで使うのは `72`** | 72 |
| 規制決定年月日 | date | YYYY/M/D | "2026/4/1" |
| 都道府県別ユニークキー | string | 都道府県内で一意 | "3000123" |
| 規制場所の経度緯度 | string | スペース区切り複数値 | "139.75425 35.18992 139.75500 35.19000" |

## 重要: 経度緯度の特殊フォーマット

1セル内に**スペース区切りで複数の経度緯度ペア**が格納されています。

```
139.75425 35.18992 139.75500 35.19000 139.75575 35.19008
└─ペア1─┘ └─ペア2─┘ └─ペア3─┘
```

これは **LineString**（線分）として扱う必要があります。駐車区間は道路上の連続した区域だからです。

`packages/data-pipeline/src/fetch-jartic.ts` の `parseCoordinates()` 関数で分解しています。

## 規制種別コード（本プロジェクトで使うもの）

| コード | 名称 | 用途 |
|---|---|---|
| 72 | 時間制限駐車区間 | **メイン**: メーター/チケットの位置・時間情報 |
| 22 | 駐車禁止 | 重複検出: メーター時間外でも停められないトラップ判定 |
| 21 | 駐停車禁止 | 同上、より厳しい規制 |
| 73 | 高齢運転者等専用駐車区間 | フィルター用 |

完全な 103 種別リストは JARTIC 公式の「交通規制情報（103種別）の説明書」を参照。

## 規制種別 = 72 の詳細フィールド

時間制限駐車区間レコードには、上記共通カラムに加えて以下の情報が含まれます:

- **車両区分**: 普通車 / トラック / 二輪 / 高齢運転者等専用
- **規制時間帯**: 開始時刻〜終了時刻（複数あり得る）
- **適用曜日**: 月〜日
- **適用除外**: 祝日除外フラグ等
- **制限時間**: 20分 / 40分 / 60分
- **手数料**: 円

> ⚠️ **注意**: 詳細フィールドの正確な列名は JARTIC の説明書（PDF）を要確認。
> 現状の `extract-meters.ts` の実装は推測に基づくフィールド名なので、実データで検証必要。

## サンプルレコード（推測）

```csv
13,100,72,2026/4/1,3000123,"139.75425 35.18992 139.75500 35.19000",普通車,09:00-19:00,月火水木金土,祝日除外,60,300
```

## 重複規制の検出方法

メーター時間外でも停められない場所を判定するため、以下のロジックを使います:

1. 規制種別 = 72 のレコードを抽出
2. 各レコードの座標群について、規制種別 = 21, 22 のレコードと座標が近い（約20m以内）ものを探す
3. 見つかった他規制を `overlappingRegulations` フィールドに格納
4. ステータス判定時に重複規制をチェック

`packages/data-pipeline/src/to-geojson.ts` の `findOverlapping()` を参照。

## アーカイブされた過去データの活用

JARTIC は前月分を消去するため、有志が運営するミラーサイトが過去データを保存しています:

- http://public-data.jartic-raws.durasite.net/opendata.html

Claude Code がデータ取得を実装する際、このミラーから過去データもダウンロード可能か検討してください。**ただしミラーサイトは公式ではないので、本番運用では JARTIC の規約遵守の確認が必要**。

## 内閣府 祝日データ

別ソース: https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv

```csv
国民の祝日・休日月日,国民の祝日・休日名称
2026/1/1,元日
2026/1/12,成人の日
...
```

- 文字コード: Shift_JIS
- 1955年〜翌年分まで含む
- 振替休日・国民の休日も含まれる

`packages/data-pipeline/src/fetch-holidays.ts` で取得・JSON化しています。

---

## 実装上の Tips

### Shift_JIS の扱い

```ts
import iconv from "iconv-lite";

const buffer = await readFile("data.csv");
const utf8Text = iconv.decode(buffer, "Shift_JIS");
```

### CSV パース

```ts
import { parse } from "csv-parse/sync";

const records = parse(utf8Text, {
  columns: true,           // 1行目をヘッダーとして使う
  skip_empty_lines: true,
  trim: true,
});
```

### ZIP 解凍

```ts
import unzipper from "unzipper";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";

await pipeline(
  createReadStream(zipPath),
  unzipper.Extract({ path: extractDir })
);
```

### 文字化けデバッグ

CSV を Excel で開くと Shift_JIS 由来の文字化けが起きやすい。VSCode で `エンコードを再選択 → Shift_JIS` で読むとよい。
