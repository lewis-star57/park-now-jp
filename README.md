# 🅿️ Park Now JP

> 「今この瞬間、停められるか？」が一目でわかる、日本全国対応のパーキングメーター PWA

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Data: CC-BY 4.0](https://img.shields.io/badge/Data-CC--BY%204.0-green.svg)](https://creativecommons.org/licenses/by/4.0/)
[![Status](https://img.shields.io/badge/Status-WIP-orange.svg)]()

## 🎯 これは何？

警視庁 `parking-meter.jp` のオープンデータポータルが終了し、後継となる便利なサービスが見つからなかったので作りました。

JARTIC（公益財団法人 日本道路交通情報センター）のオープンデータを使って、全国のパーキングメーター（時間制限駐車区間）を地図上に表示し、**現在時刻と祝日情報を組み合わせて「今すぐ停められるかどうか」を判定**します。

## ✨ 特徴

- 🟢🟡🔴 **3色で一目瞭然** — 今この瞬間「無料」「有料稼働中」「駐車不可」を判定
- 🗾 **全国対応** — JARTIC の交通規制情報オープンデータから自動生成
- 📅 **祝日対応** — 内閣府データを同梱、オフラインでも正確に判定
- 📱 **PWA** — ホーム画面に追加してネイティブアプリ風に使える
- 💾 **オフライン動作** — 一度開いたエリアは電波がなくても確認可能
- ⭐ **お気に入り・履歴** — よく使うスポットを保存
- 🔔 **時間切れ通知**（予定）— Web Push でアラート
- 🚫 **トラップ警告** — メーター停止中だが駐禁規制で実は停められない場所を検出

## 🚀 開発を始める

### 必要なもの

- Node.js 20 以上
- pnpm 9 以上

### セットアップ

```bash
git clone https://github.com/lewis-star57/park-now-jp.git
cd park-now-jp
pnpm install

# データを取得（初回のみ。少し時間がかかります）
pnpm data:fetch

# 開発サーバー起動
pnpm dev
```

ブラウザで http://localhost:3000 を開いてください。

### スクリプト

| コマンド | 説明 |
|---|---|
| `pnpm dev` | 開発サーバー起動 |
| `pnpm build` | プロダクションビルド |
| `pnpm test` | vitest でテスト実行 |
| `pnpm lint` | ESLint + Prettier チェック |
| `pnpm data:fetch` | JARTIC からデータ取得・GeoJSON 化 |
| `pnpm data:fetch:tokyo` | 東京都のみ（開発時の高速化） |

## 📊 データソース

このアプリは以下のオープンデータを使用しています:

- **交通規制情報（103種別）** — 公益財団法人 日本道路交通情報センター (JARTIC)
  - https://www.jartic.or.jp/service/opendata/
  - ライセンス: CC-BY 4.0
- **国民の祝日について** — 内閣府
  - https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html

データは GitHub Actions により毎月自動更新されます。

## ⚠️ 免責事項

**本アプリの情報は参考であり、実地の標識・道路標示が常に優先します。**

データの正確性・最新性については保証しません。駐車前に必ず現地で規制標識を確認してください。違反による罰則・損害について本プロジェクトは一切の責任を負いません。

特に以下のケースに注意:
- メーター時間外でも「24時間駐車禁止」の標識がある場合は駐車不可
- 同じ場所に複数の規制（時間指定駐車禁止など）が重なっている場合
- 工事・イベント等による一時的な規制変更

## 🤝 コントリビューション

PR 歓迎です！詳しくは [CONTRIBUTING.md](./CONTRIBUTING.md) を参照。

特に募集中:
- 各都道府県のローカルルール情報の検証
- UI/UX デザインの改善
- 多言語対応（英語・中国語・韓国語）
- アクセシビリティ改善

## 📜 ライセンス

- ソースコード: [MIT License](./LICENSE)
- ドキュメント: [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- データ: 各データソースのライセンスに従います（上記参照）

## 🙏 謝辞

- 警視庁 `parking-meter.jp` のチーム — 元のサービスが優れたインスピレーションとなりました
- JARTIC — オープンデータの公開に感謝
- 内閣府 — 祝日データの公開に感謝

---

Made with ❤️ in Tokyo
