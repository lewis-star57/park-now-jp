/**
 * 祝日データ（data.json）の鮮度チェック（カナリアテスト）
 *
 * 祝日データが尽きると isHoliday は黙って false を返し続け、祝日でも
 * 「稼働中（有料）」と誤表示される。これを事前に検知するため、
 * 「データ内の最後の祝日が今日から 90 日以上先にあるか」を CI で監視する。
 *
 * 注意: このテストは鮮度監視という目的上、意図的に実行時刻（Date.now）に
 * 依存する（判定ロジック本体の「Date.now() 禁止」ルールの例外）。
 *
 * 落ちたときの対処: `pnpm data:fetch:holidays` を実行して
 * apps/web/lib/holidays/data.json を更新し、コミットする。
 * （update-data.yml の月次自動実行が正常なら、自動 PR でも更新される）
 */

import { describe, expect, it } from "vitest";
import { getAllHolidays } from "./index";

/** 「残り何日を切ったら警告するか」のしきい値 */
const WARN_BEFORE_DAYS = 90;

describe("祝日データの健全性", () => {
  it("データが空でなく、すべて YYYY-MM-DD 形式で祝日名を持つ", () => {
    const holidays = getAllHolidays();
    expect(holidays.length).toBeGreaterThan(0);
    for (const h of holidays) {
      expect(h.date, `不正な日付形式: ${JSON.stringify(h)}`).toMatch(
        /^\d{4}-\d{2}-\d{2}$/
      );
      expect(h.name.length, `祝日名が空: ${JSON.stringify(h)}`).toBeGreaterThan(0);
    }
  });

  it(`最後の祝日が今日から ${WARN_BEFORE_DAYS} 日以上先にある`, () => {
    const dates = getAllHolidays()
      .map((h) => h.date)
      .sort();
    const lastDate = dates[dates.length - 1];
    expect(lastDate).toBeDefined();

    // JST の日付として解釈（鮮度判定なので分単位の厳密さは不要）
    const lastTime = new Date(`${lastDate}T00:00:00+09:00`).getTime();
    const deadline = Date.now() + WARN_BEFORE_DAYS * 24 * 60 * 60 * 1000;

    expect(
      lastTime,
      `祝日データの残りが ${WARN_BEFORE_DAYS} 日を切りました（データ内の最終祝日: ${lastDate}）。` +
        `「pnpm data:fetch:holidays」を実行して apps/web/lib/holidays/data.json を更新し、コミットしてください。`
    ).toBeGreaterThanOrEqual(deadline);
  });
});
