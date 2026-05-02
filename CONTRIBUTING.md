# Contributing to Park Now JP

ありがとうございます！🎉 PR・Issue 大歓迎です。

## 開発を始める前に

1. [README.md](./README.md) を読む
2. [CLAUDE.md](./CLAUDE.md) を読む（プロジェクトの設計思想・規約）
3. [docs/](./docs) のドキュメントを確認

## 開発の流れ

### 1. Issue を立てる（推奨）

機能追加や大きめのバグ修正の場合は、まず Issue を立てて議論してください。
小さな修正（typo、ドキュメント改善）は Issue 不要です。

### 2. ブランチ命名

```
feat/xxx     - 新機能
fix/xxx      - バグ修正
chore/xxx    - 雑務
docs/xxx     - ドキュメント
refactor/xxx - リファクタリング
test/xxx     - テスト追加
```

### 3. コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/) に従う:

```
feat: 現在地ボタンを追加
fix(status): 祝日深夜の判定ミスを修正
docs: README にデモ GIF を追加
chore(deps): Next.js を 15.0.1 に更新
```

### 4. PR 作成

PR テンプレートに従って記入してください。特に:

- [ ] テストを追加した（コードの変更がある場合）
- [ ] `pnpm lint` `pnpm typecheck` `pnpm test` がすべて通る
- [ ] **実地で動作確認した**（UI/UX 変更の場合）
- [ ] ドキュメントを更新した（仕様変更の場合）

## コーディング規約

### TypeScript

- `strict: true` 必須
- `any` 禁止
- 型定義は `packages/shared/src/types.ts` を優先利用

### React

- 関数コンポーネント + Hooks のみ
- props は `interface` で型定義
- `"use client"` は必要な箇所のみ

### スタイリング

- Tailwind CSS を使用
- カスタム CSS は `globals.css` のみ
- 色は CSS variables 経由（`var(--color-status-free)` 等）

### 命名

- ファイル名: `kebab-case.ts` または `PascalCase.tsx`（コンポーネント）
- 関数: `camelCase`
- 型: `PascalCase`
- 定数: `UPPER_SNAKE_CASE`

## テスト

- ステータス判定のような重要なロジックには **必ず** テストを書く
- vitest を使用
- テストファイル名: `xxx.test.ts`

```bash
pnpm test                              # 全テスト
pnpm --filter @park-now-jp/web test    # web のみ
```

## ドキュメント

- 重要な変更は `docs/` にメモを残す
- 公開 API（`packages/shared`）の変更は CHANGELOG に記載

## 法務上の注意

- **データの利用規約に違反する変更は受け付けません**
- **免責文言の削除・改変は禁止**（[docs/DISCLAIMER.md](./docs/DISCLAIMER.md) 参照）
- 出典明記の削除は禁止

## ローカルルール情報の追加

各都道府県の細かいローカルルール（特殊な祝日扱い等）の情報をお持ちの方は、Issue または PR で教えてください！実地確認した情報を特に歓迎します。

## 行動規範

- 互いに敬意を持って接する
- 建設的なフィードバックを心がける
- 政治的・宗教的議論は避ける

---

ありがとうございます！日本の駐車事情を少しでも改善できればと思います 🅿️
