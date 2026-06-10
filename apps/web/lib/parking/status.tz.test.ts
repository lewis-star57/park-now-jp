/**
 * タイムゾーン回帰テスト（TZ=UTC 固定で実行）
 *
 * 「日本時間以外の端末（訪日外国人のスマホ等）でも判定がズレない」ことを
 * 保証する。コードレビューで実証された以下 2 件のバグの再発防止:
 *   - 祝日判定の二重タイムゾーン変換（JST 15時以降に翌日の祝日状態で判定される）
 *   - nextChangeAt が端末タイムゾーン依存（JST 以外の端末で 9 時間ズレる）
 *
 * このファイルは process.env.TZ を UTC に切り替えて実行する
 * （Node 16.2+ は TZ への代入で Date のタイムゾーンキャッシュを破棄する）。
 * 前提が崩れた場合に気づけるよう、最初のテストで TZ=UTC を検証する。
 *
 * 祝日判定はテスト用フィクスチャではなく本番の lib/holidays（内閣府データ
 * 同梱）をそのまま使い、本番経路で回帰を検出する。
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ParkingMeter } from "@park-now-jp/shared";
import { isHoliday } from "@/lib/holidays";
import { evaluateStatus } from "./status";

const ORIGINAL_TZ = process.env.TZ;

beforeAll(() => {
  process.env.TZ = "UTC";
});

afterAll(() => {
  if (ORIGINAL_TZ === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = ORIGINAL_TZ;
  }
});

// ============================================================================
// テストフィクスチャ
// ============================================================================

/** 祝日除外・重複規制なしの基本メーター（月-土 9:00-19:00） */
const holidayExcludedMeter: ParkingMeter = {
  id: "13_tz_holiday_excluded",
  prefCode: "13",
  policeStationCode: "100",
  name: "TZ回帰テスト用メーター",
  spaces: 2,
  timeLimitMinutes: 60,
  feeYen: 300,
  vehicleType: "standard",
  operatingHours: [{ startTime: "09:00", endTime: "19:00" }],
  operatingDays: [1, 2, 3, 4, 5, 6], // 月-土
  exclusions: ["holidays"],
  overlappingRegulations: [],
  lastUpdated: "2026-06-01",
};

/** 日跨ぎ稼働メーター（毎日 22:00-06:00） */
const overnightMeter: ParkingMeter = {
  ...holidayExcludedMeter,
  id: "13_tz_overnight",
  name: "TZ回帰テスト用 日跨ぎメーター",
  operatingHours: [{ startTime: "22:00", endTime: "06:00" }],
  operatingDays: [0, 1, 2, 3, 4, 5, 6],
  exclusions: [],
};

/** JST の壁時計時刻を実時刻（UTC Date）として作る */
const tokyo = (date: string, hour: number, minute: number = 0): Date => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, hour - 9, minute));
};

// ============================================================================
// テストケース
// ============================================================================

describe("タイムゾーン回帰（TZ=UTC）", () => {
  it("前提: このファイルは TZ=UTC で実行されている", () => {
    const probe = new Date("2026-01-01T12:00:00Z");
    expect(probe.getTimezoneOffset()).toBe(0);
    expect(probe.getHours()).toBe(12);
  });

  describe("祝日判定（本番の isHoliday を使用）", () => {
    it("祝日（勤労感謝の日 2026-11-23 月曜）16:00 → free（修正前: 翌日扱いで paid になっていた）", () => {
      // JST 15時以降は二重変換バグだと翌日(11/24 平日)として判定され、
      // 月曜稼働中 = paid と誤表示されていた
      const status = evaluateStatus(
        holidayExcludedMeter,
        tokyo("2026-11-23", 16, 0),
        isHoliday
      );
      expect(status.level).toBe("free");
      expect(status.message).toBe("日祝のため無料");
    });

    it("祝日の前日（2026-05-02 土曜）16:00 → paid（修正前: 翌日の祝日に引きずられ free 誤表示 = 危険方向）", () => {
      const status = evaluateStatus(
        holidayExcludedMeter,
        tokyo("2026-05-02", 16, 0),
        isHoliday
      );
      expect(status.level).toBe("paid");
    });

    it("祝日（憲法記念日 2026-05-03）の午前中 10:00 → free", () => {
      const status = evaluateStatus(
        holidayExcludedMeter,
        tokyo("2026-05-03", 10, 0),
        isHoliday
      );
      expect(status.level).toBe("free");
    });
  });

  describe("nextChangeAt の絶対時刻（修正前: 端末 TZ が JST のときだけ正しかった）", () => {
    it("月曜 14:00 稼働中 → 終了 19:00 JST = 10:00 UTC", () => {
      const status = evaluateStatus(
        holidayExcludedMeter,
        tokyo("2026-05-11", 14, 0),
        isHoliday
      );
      expect(status.level).toBe("paid");
      expect(status.nextChangeAt).toBe("2026-05-11T10:00:00.000Z");
    });

    it("日跨ぎ稼働（22:00-06:00）の夜側 23:00 → 終了は翌朝 06:00 JST（修正前: 翌日 0:00 という誤った境界）", () => {
      const status = evaluateStatus(
        overnightMeter,
        tokyo("2026-05-11", 23, 0),
        isHoliday
      );
      expect(status.level).toBe("paid");
      // JST 2026-05-12 06:00 = UTC 2026-05-11 21:00
      expect(status.nextChangeAt).toBe("2026-05-11T21:00:00.000Z");
    });

    it("日跨ぎ稼働（22:00-06:00）の深夜側 01:00 → 終了は当日 06:00 JST", () => {
      const status = evaluateStatus(
        overnightMeter,
        tokyo("2026-05-12", 1, 0),
        isHoliday
      );
      expect(status.level).toBe("paid");
      expect(status.nextChangeAt).toBe("2026-05-11T21:00:00.000Z");
    });
  });
});
