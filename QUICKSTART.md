# 🚀 Claude Code クイックスタート

このプロジェクトを Claude Code で開発する手順です。

## 1. プロジェクトをセットアップ

```bash
# このディレクトリに移動
cd park-now-jp

# Git 初期化
git init
git add .
git commit -m "chore: initial scaffold"

# GitHub リポジトリを作成して push
gh repo create lewis-star57/park-now-jp --public --source=. --push

# 依存関係をインストール
pnpm install
```

## 2. Claude Code を起動

```bash
claude
```

最初のプロンプト例:

```
@CLAUDE.md を読みました。Phase 1 の MVP を進めます。

まず以下を実装してください:
1. apps/web/app/page.tsx に MapLibre GL JS で地図表示を実装
2. apps/web/public/data/13.geojson にサンプルデータを置く（神保町10件程度）
3. lib/parking/status.ts を使って各メーターを 3 色で描画
4. ボトムシートを作って、タップで詳細表示
5. 「今すぐ無料」フィルターチップを実装

参考: outputs/parking_meter_app.html （Leaflet で書いた参考実装）
```

## 3. データを取得（後で）

実装が落ち着いたら:

```bash
pnpm data:fetch:tokyo  # 東京のみ取得
```

## 4. 開発サーバー起動

```bash
pnpm dev
```

http://localhost:3000

## 5. PWA としてインストール

ビルド後:

```bash
pnpm build
pnpm start
```

ブラウザで開いて「ホーム画面に追加」できることを確認。

---

## 開発の進め方の推奨フロー

1. **CLAUDE.md を Claude Code に最初に読ませる**
2. **Phase 1 (MVP) から順番に進める**
3. **小さな PR を積み重ねる**（1機能 = 1PR）
4. **テストを書きながら進める**（TDD 風）
5. **困ったら `docs/` にメモを残す**

## トラブルシューティング

### `pnpm install` がコケる

Node.js のバージョンが古い可能性。`node -v` で v20 以上を確認。

### TypeScript エラー

`packages/shared` がビルドされていない可能性:
```bash
pnpm --filter @park-now-jp/shared typecheck
```

### MapLibre が表示されない

CSS が読み込まれていない可能性。`apps/web/app/layout.tsx` で:
```tsx
import "maplibre-gl/dist/maplibre-gl.css";
```

---

頑張って！🅿️
