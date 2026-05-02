# ステータス判定ロジック（STATUS_LOGIC）

> このドキュメントは Park Now JP の中核となる「今この瞬間、停められるか」判定の数学とエッジケースを解説します。

## 基本原則

ステータス判定は **3つの要素の積** です:

```
status = f(現在時刻, メーター稼働情報, 重複する駐車禁止規制)
```

## 出力ステータスの種類

| Level | 色 | 意味 |
|---|---|---|
| `free` | 🟢 緑 | 今この瞬間、無料で停められる |
| `paid` | 🟡 黄 | メーター稼働中、料金支払いで停められる |
| `closed` | 🔴 赤 | 駐車不可（駐禁規制が有効） |

## 判定フロー（厳格な優先順位）

```
START
  │
  ├─ Step 1: 同位置の駐禁規制をチェック
  │   ├─ 24時間駐禁が重複している？
  │   │   └─ YES → メーター時間内なら paid、時間外なら closed
  │   │
  │   └─ 時間限定の駐禁が重複している？
  │       └─ メーター時間外でも駐禁時間内なら closed
  │
  ├─ Step 2: メーター稼働判定
  │   ├─ 適用曜日 × 適用時間帯にマッチする？
  │   │   └─ YES → paid
  │   │
  │   └─ NO → Step 3 へ
  │
  └─ Step 3: 駐禁規制も解除されているなら free
```

## 重要なエッジケース

### ケース1: 緑線メーター（日祝休み）

```yaml
operatingDays: [1, 2, 3, 4, 5, 6]    # 月-土
exclusions: ["holidays"]              # 祝日除外
overlappingRegulations:
  - description: "駐車禁止 8:00-20:00 日祝除く"
    operatingDays: [1, 2, 3, 4, 5, 6]
    isAllDay: false
```

**期待される結果**:

| 状況 | 結果 |
|---|---|
| 月曜 14:00 | paid（メーター稼働中） |
| 月曜 21:00 | free（メーター時間外、駐禁も解除） |
| 日曜 14:00 | **free**（祝日扱い → メーター停止 + 駐禁解除） |
| 祝日 14:00 | **free** |

### ケース2: 青線メーター（毎日稼働）

```yaml
operatingDays: [0, 1, 2, 3, 4, 5, 6]  # 全曜日
exclusions: []
```

| 状況 | 結果 |
|---|---|
| 日曜 14:00 | paid（毎日稼働なので有料） |

### ケース3: トラップエリア（24時間駐禁）

```yaml
operatingDays: [0, 1, 2, 3, 4, 5, 6]
overlappingRegulations:
  - description: "駐車禁止 24時間"
    isAllDay: true
```

| 状況 | 結果 |
|---|---|
| 月曜 14:00 | paid（メーター稼働中、料金支払えば停められる） |
| 月曜 21:00 | **closed**（メーター時間外でも駐禁継続） |
| 日曜 14:00 | **closed** |

これが **最も重要なトラップ判定**。元の警視庁 parking-meter.jp ですらこれを正確に表現できていなかった。

### ケース4: メーター時間と駐禁時間がずれている

```yaml
operatingHours: [{ startTime: "09:00", endTime: "19:00" }]    # メーター
overlappingRegulations:
  - operatingHours: [{ startTime: "08:00", endTime: "20:00" }] # 駐禁
```

| 状況 | 結果 |
|---|---|
| 月曜 19:30 | **closed**（メーター終了したが駐禁はまだ） |

### ケース5: 日跨ぎの規制（夜間駐禁）

```yaml
overlappingRegulations:
  - operatingHours: [{ startTime: "22:00", endTime: "06:00" }]
    isAllDay: false
```

`status.ts` の `isWithinHours()` は日跨ぎ対応済み（end < start のとき OR 評価）。

## 境界値の扱い

時刻の比較は **半開区間** `[start, end)`:

- 09:00 ちょうど → メーター時間内（true）
- 19:00 ちょうど → メーター時間外（false）

これは標準的な営業時間表記の慣例に従っています。「9時開始、19時終了」というメッセージなら 19:00 ジャストには止まれない、と読むのが自然です。

## タイムゾーン

**必ず Asia/Tokyo で判定**。

```ts
import { toZonedTime } from "date-fns-tz";
const jst = toZonedTime(now, "Asia/Tokyo");
```

理由:
- Vercel サーバーは UTC で動作
- JARTIC データは JST 前提
- ユーザーが海外から見ても日本の規制は JST で動く

## テストカバレッジの要件

`apps/web/lib/parking/status.test.ts` で以下を網羅すること:

- [x] 平日昼（メーター稼働中）
- [x] 平日夜（メーター停止 + 駐禁解除 → free）
- [x] 平日メーター時間外 + 駐禁時間内（→ closed）
- [x] 日曜の緑線（→ free）
- [x] 日曜の青線（→ paid）
- [x] 祝日の緑線（→ free）
- [x] 24時間駐禁エリア（→ closed in 時間外）
- [x] メーター開始/終了時刻ちょうど
- [x] 駐禁終了時刻ちょうど
- [ ] 日跨ぎ規制（22:00-06:00 等）
- [ ] 振替休日（5/6 等）
- [ ] 国民の休日（5/4, 9/22 等）

## デザイン上の判断

### なぜ 3 段階？

5 段階や色グラデーションは UX 上ノイズになる。**3秒で判断できる**ためには、見た目に明確な差が必要。

### なぜ「警告」を分離？

`free` 判定でも、実地の標識確認は必須。warning フィールドでこれを伝える。色は変えない（ユーザーの意思決定を妨げないため）。

### nextChangeAt の用途

「あと10分で稼働終了」のような時間表示や、 PWA 通知の予約に使う。

```ts
const status = evaluateStatus(meter, new Date(), isHoliday);
if (status.nextChangeAt) {
  const minutesUntil = Math.round(
    (new Date(status.nextChangeAt).getTime() - Date.now()) / 60000
  );
  // 表示: 「あと 23 分で稼働終了」
}
```

## 今後の拡張

- [ ] **繁忙度予測**: 過去の駐車実績データから「今は満車率 80%」のような予測
- [ ] **イベント考慮**: 大規模イベント時の臨時規制
- [ ] **天候考慮**: 雪国の冬季規制
- [ ] **ローカルカスタムルール**: 都道府県ごとに微妙に異なる祝日扱いなど
