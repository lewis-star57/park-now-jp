/**
 * Status Evaluator のテスト
 *
 * このテストは「仕様書」としても機能します。
 * Claude Code は新しいエッジケースを発見したらここにテストを追加してください。
 */

import { describe, expect, it } from "vitest";
import type { Holiday, ParkingMeter } from "@park-now-jp/shared";
import { evaluateStatus } from "./status";

// ============================================================================
// テストフィクスチャ
// ============================================================================

const HOLIDAYS_2026: Holiday[] = [
  { date: "2026-01-01", name: "元日" },
  { date: "2026-05-03", name: "憲法記念日" },
  { date: "2026-05-04", name: "みどりの日" },
  { date: "2026-05-05", name: "こどもの日" },
];

const isHoliday = (date: Date): boolean => {
  const ymd = date.toISOString().split("T")[0];
  return HOLIDAYS_2026.some((h) => h.date === ymd);
};

/** 標準的なメーター（平日のみ稼働、9:00-19:00） */
const standardMeter: ParkingMeter = {
  id: "13_test_standard",
  prefCode: "13",
  policeStationCode: "100",
  name: "テスト標準メーター",
  spaces: 4,
  timeLimitMinutes: 60,
  feeYen: 300,
  vehicleType: "standard",
  operatingHours: [{ startTime: "09:00", endTime: "19:00" }],
  operatingDays: [1, 2, 3, 4, 5, 6], // 月-土
  exclusions: ["holidays"],
  overlappingRegulations: [
    {
      code: 22,
      description: "駐車禁止 (8:00-20:00 日祝除く)",
      operatingHours: [{ startTime: "08:00", endTime: "20:00" }],
      operatingDays: [1, 2, 3, 4, 5, 6],
      isAllDay: false,
    },
  ],
  lastUpdated: "2026-04-01",
};

/** 24時間駐禁エリアのメーター */
const allDayBanMeter: ParkingMeter = {
  ...standardMeter,
  id: "13_test_allday_ban",
  name: "24時間駐禁メーター",
  overlappingRegulations: [
    {
      code: 22,
      description: "駐車禁止 (24時間)",
      isAllDay: true,
    },
  ],
};

/** 毎日稼働の青線メーター */
const dailyMeter: ParkingMeter = {
  ...standardMeter,
  id: "13_test_daily",
  name: "毎日稼働メーター",
  operatingDays: [0, 1, 2, 3, 4, 5, 6],
  exclusions: [],
  overlappingRegulations: [
    {
      code: 22,
      description: "駐車禁止 (8:00-20:00)",
      operatingHours: [{ startTime: "08:00", endTime: "20:00" }],
      operatingDays: [0, 1, 2, 3, 4, 5, 6],
      isAllDay: false,
    },
  ],
};

const tokyo = (date: string, hour: number, minute: number = 0): Date => {
  // JST で指定された時刻を UTC として表現するため、9時間引く
  const [y, m, d] = date.split("-").map(Number);
  // テストフィクスチャでは固定形式 "YYYY-MM-DD" を渡すので non-null 保証
  return new Date(Date.UTC(y!, m! - 1, d!, hour - 9, minute));
};

// ============================================================================
// テストケース
// ============================================================================

describe("evaluateStatus", () => {
  describe("平日昼間（メーター稼働中）", () => {
    it("月曜 14:00 → paid を返す", () => {
      const status = evaluateStatus(
        standardMeter,
        tokyo("2026-05-11", 14, 0), // 月曜
        isHoliday
      );
      expect(status.level).toBe("paid");
      expect(status.message).toBe("60分 ¥300");
    });

    it("メーター時間ちょうど 9:00 → paid", () => {
      const status = evaluateStatus(
        standardMeter,
        tokyo("2026-05-11", 9, 0),
        isHoliday
      );
      expect(status.level).toBe("paid");
    });
  });

  describe("平日夜間（メーター停止 + 駐禁規制も解除）", () => {
    it("月曜 21:00 → free", () => {
      const status = evaluateStatus(
        standardMeter,
        tokyo("2026-05-11", 21, 0),
        isHoliday
      );
      expect(status.level).toBe("free");
    });

    it("月曜 早朝 6:00 → free", () => {
      const status = evaluateStatus(
        standardMeter,
        tokyo("2026-05-11", 6, 0),
        isHoliday
      );
      expect(status.level).toBe("free");
    });

    it("メーター終了直後 19:00 → 規制継続中なので closed", () => {
      // メーターは 19:00 終了、駐禁規制は 20:00 まで → メーター時間外 + 駐禁時間内
      const status = evaluateStatus(
        standardMeter,
        tokyo("2026-05-11", 19, 0),
        isHoliday
      );
      expect(status.level).toBe("closed");
      expect(status.detail).toContain("駐車禁止");
    });
  });

  describe("日曜・祝日", () => {
    it("日曜 14:00（緑線メーター）→ free", () => {
      const status = evaluateStatus(
        standardMeter,
        tokyo("2026-05-10", 14, 0), // 日曜
        isHoliday
      );
      expect(status.level).toBe("free");
      expect(status.message).toContain("無料");
    });

    it("祝日 14:00（緑線メーター）→ free", () => {
      const status = evaluateStatus(
        standardMeter,
        tokyo("2026-05-03", 14, 0), // 憲法記念日
        isHoliday
      );
      expect(status.level).toBe("free");
    });

    it("日曜 14:00（青線メーター = 毎日稼働）→ paid", () => {
      const status = evaluateStatus(
        dailyMeter,
        tokyo("2026-05-10", 14, 0),
        isHoliday
      );
      expect(status.level).toBe("paid");
    });
  });

  describe("24時間駐禁エリア（重複規制トラップ）", () => {
    it("どの時刻でも closed", () => {
      const monday14 = evaluateStatus(allDayBanMeter, tokyo("2026-05-11", 14, 0), isHoliday);
      const monday23 = evaluateStatus(allDayBanMeter, tokyo("2026-05-11", 23, 0), isHoliday);
      const sunday14 = evaluateStatus(allDayBanMeter, tokyo("2026-05-10", 14, 0), isHoliday);

      // メーター時間内は paid (メーター自体は稼働中)
      expect(monday14.level).toBe("paid");
      // メーター時間外は重複規制で closed
      expect(monday23.level).toBe("closed");
      expect(monday23.message).toContain("24時間");
      // 日曜（メーター時間外）も重複規制で closed
      expect(sunday14.level).toBe("closed");
    });
  });

  describe("境界値", () => {
    it("メーター開始 09:00 ちょうど → paid", () => {
      const status = evaluateStatus(standardMeter, tokyo("2026-05-11", 9, 0), isHoliday);
      expect(status.level).toBe("paid");
    });

    it("メーター終了 18:59 → paid", () => {
      const status = evaluateStatus(standardMeter, tokyo("2026-05-11", 18, 59), isHoliday);
      expect(status.level).toBe("paid");
    });

    it("駐禁終了 20:00 ちょうど → free", () => {
      const status = evaluateStatus(standardMeter, tokyo("2026-05-11", 20, 0), isHoliday);
      expect(status.level).toBe("free");
    });
  });

  describe("nextChangeAt", () => {
    it("メーター稼働中はメーター終了時刻を返す", () => {
      const status = evaluateStatus(standardMeter, tokyo("2026-05-11", 14, 0), isHoliday);
      expect(status.nextChangeAt).toBeDefined();
      // 14:00 → 次は 19:00
      const next = new Date(status.nextChangeAt!);
      expect(next.getUTCHours()).toBe(10); // 19 JST = 10 UTC
    });
  });
});
