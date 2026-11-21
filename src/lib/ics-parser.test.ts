// AC-007 ICS 解析器測試：使用 tests/fixtures/ 下自行編寫的假 Airbnb／Booking.com 格式檔案。
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IcsParseError, parseIcsText } from "@/lib/ics-parser";

const fixture = (name: string) =>
  readFileSync(path.resolve(__dirname, "../../tests/fixtures", name), "utf8");

const wrap = (...eventLines: string[]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", ...eventLines, "END:VEVENT", "END:VCALENDAR"].join("\r\n");

const iso = (d: Date) => d.toISOString();

describe("AC-007 假 Airbnb 格式 fixture", () => {
  const events = parseIcsText(fixture("airbnb-fake.ics"));

  it("AC-007 解析出 3 筆事件", () => {
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.summary)).toEqual(["Reserved", "Airbnb (Not available)", "Reserved"]);
  });

  it("AC-007 全天日期（VALUE=DATE）解析為 UTC 午夜，退房日為 DTEND", () => {
    expect(events[0].uid).toBe("fake-airbnb-0001@fixture.hotel-pm.test");
    expect(iso(events[0].checkIn)).toBe("2027-01-02T00:00:00.000Z");
    expect(iso(events[0].checkOut)).toBe("2027-01-05T00:00:00.000Z");
  });

  it("AC-007 折行的 UID 會接回完整的一行", () => {
    expect(events[2].uid).toBe(
      "fake-airbnb-0003-with-a-very-long-identifier-that-gets-folded-by-the-exporter@fixture.hotel-pm.test",
    );
  });

  it("AC-007 fixture 使用 CRLF 換行", () => {
    expect(fixture("airbnb-fake.ics")).toContain("\r\n");
  });
});

describe("AC-007 假 Booking.com 格式 fixture", () => {
  it("AC-007 解析出 2 筆 CLOSED 事件", () => {
    const events = parseIcsText(fixture("booking-fake.ics"));
    expect(events).toEqual([
      {
        uid: "fake-booking-0001@fixture.hotel-pm.test",
        summary: "CLOSED - Not available",
        checkIn: new Date("2027-02-01T00:00:00.000Z"),
        checkOut: new Date("2027-02-04T00:00:00.000Z"),
      },
      {
        uid: "fake-booking-0002@fixture.hotel-pm.test",
        summary: "CLOSED - Not available",
        checkIn: new Date("2027-02-10T00:00:00.000Z"),
        checkOut: new Date("2027-02-12T00:00:00.000Z"),
      },
    ]);
  });
});

describe("AC-007 邊界案例 fixture", () => {
  const events = parseIcsText(fixture("edge-cases-fake.ics"));
  const byUid = (uid: string) => events.find((e) => e.uid === `${uid}@fixture.hotel-pm.test`);

  it("AC-007 缺 UID 的事件與退房日等於入住日的事件會被略過", () => {
    expect(events.map((e) => e.uid.replace("@fixture.hotel-pm.test", ""))).toEqual([
      "fake-edge-tz-taipei",
      "fake-edge-utc",
      "fake-edge-folded-summary",
      "fake-edge-no-summary",
    ]);
  });

  it("AC-007 時區：TZID=Asia/Taipei 的當地時間轉成 UTC（-8 小時）", () => {
    const ev = byUid("fake-edge-tz-taipei")!;
    expect(iso(ev.checkIn)).toBe("2027-03-01T07:00:00.000Z");
    expect(iso(ev.checkOut)).toBe("2027-03-03T03:00:00.000Z");
  });

  it("AC-007 時區：結尾 Z 的時間視為 UTC", () => {
    const ev = byUid("fake-edge-utc")!;
    expect(iso(ev.checkIn)).toBe("2027-03-10T07:00:00.000Z");
    expect(iso(ev.checkOut)).toBe("2027-03-12T03:00:00.000Z");
  });

  it("AC-007 跳脫字元：\\, 還原成逗號", () => {
    expect(byUid("fake-edge-utc")!.summary).toBe("測試旅客B, UTC 時間");
  });

  it("AC-007 折行的 SUMMARY 會接回完整內容", () => {
    expect(byUid("fake-edge-folded-summary")!.summary).toBe(
      "測試旅客C 的名字很長很長很長很長很長很長很長很長很長很長很長很長所以被折行",
    );
  });

  it("AC-007 沒有 SUMMARY 時改用 DESCRIPTION", () => {
    expect(byUid("fake-edge-no-summary")!.summary).toBe("只有描述沒有標題");
  });
});

describe("AC-007 折行（RFC 5545 line folding）", () => {
  it("AC-007 CRLF + 空白 與 CRLF + TAB 都視為上一行的延續", () => {
    const text = wrap(
      "UID:fake-fold-1@fixture.hotel-pm.test",
      "DTSTART;VALUE=DATE:20270501",
      "DTEND;VALUE=DATE:20270503",
      "SUMMARY:測試旅客D",
      " 第二段",
      "\t第三段",
    );
    expect(parseIcsText(text)[0].summary).toBe("測試旅客D第二段第三段");
  });

  it("AC-007 只有 LF 換行的檔案也能解析（含折行）", () => {
    const text = wrap(
      "UID:fake-fold-2@fixture.hotel-pm.test",
      "DTSTART;VALUE=DATE:2027",
      " 0501",
      "DTEND;VALUE=DATE:20270503",
      "SUMMARY:測試旅客E",
    ).replace(/\r\n/g, "\n");
    const [ev] = parseIcsText(text);
    expect(iso(ev.checkIn)).toBe("2027-05-01T00:00:00.000Z");
  });
});

describe("AC-007 全天日期與時區", () => {
  const dates = (dtstart: string, dtend: string) => {
    const [ev] = parseIcsText(wrap("UID:fake-tz@fixture.hotel-pm.test", dtstart, dtend, "SUMMARY:測試旅客F"));
    return [iso(ev.checkIn), iso(ev.checkOut)];
  };

  it("AC-007 沒有 VALUE=DATE 參數的純日期同樣視為全天", () => {
    expect(dates("DTSTART:20270601", "DTEND:20270603")).toEqual([
      "2027-06-01T00:00:00.000Z",
      "2027-06-03T00:00:00.000Z",
    ]);
  });

  it("AC-007 TZID=Asia/Tokyo（UTC+9）", () => {
    expect(dates("DTSTART;TZID=Asia/Tokyo:20270601T150000", "DTEND;TZID=Asia/Tokyo:20270602T100000")).toEqual([
      "2027-06-01T06:00:00.000Z",
      "2027-06-02T01:00:00.000Z",
    ]);
  });

  it("AC-007 Etc/GMT-8 代表 UTC+8（POSIX 正負號相反）", () => {
    expect(dates("DTSTART;TZID=Etc/GMT-8:20270601T080000", "DTEND;TZID=Etc/GMT-8:20270602T080000")).toEqual([
      "2027-06-01T00:00:00.000Z",
      "2027-06-02T00:00:00.000Z",
    ]);
  });

  it("AC-007 沒有時區也沒有 Z 的時間（floating）視為 UTC", () => {
    expect(dates("DTSTART:20270601T150000", "DTEND:20270602T110000")).toEqual([
      "2027-06-01T15:00:00.000Z",
      "2027-06-02T11:00:00.000Z",
    ]);
  });

  it("AC-007 不支援的時區會拋 IcsParseError（不猜測）", () => {
    expect(() =>
      parseIcsText(
        wrap(
          "UID:fake-tz-bad@fixture.hotel-pm.test",
          "DTSTART;TZID=Mars/Olympus_Mons:20270601T150000",
          "DTEND;TZID=Mars/Olympus_Mons:20270602T110000",
          "SUMMARY:測試旅客G",
        ),
      ),
    ).toThrow(IcsParseError);
  });
});

describe("AC-007 缺欄位與無效內容", () => {
  it("AC-007 缺 UID 略過", () => {
    expect(parseIcsText(wrap("DTSTART;VALUE=DATE:20270701", "DTEND;VALUE=DATE:20270703", "SUMMARY:x"))).toEqual([]);
  });
  it("AC-007 缺 DTSTART 或 DTEND 略過", () => {
    expect(parseIcsText(wrap("UID:a@fixture.hotel-pm.test", "DTEND;VALUE=DATE:20270703"))).toEqual([]);
    expect(parseIcsText(wrap("UID:a@fixture.hotel-pm.test", "DTSTART;VALUE=DATE:20270701"))).toEqual([]);
  });
  it("AC-007 退房日早於入住日略過", () => {
    expect(
      parseIcsText(wrap("UID:a@fixture.hotel-pm.test", "DTSTART;VALUE=DATE:20270705", "DTEND;VALUE=DATE:20270703")),
    ).toEqual([]);
  });
  it("AC-007 沒有 SUMMARY 也沒有 DESCRIPTION 時以 UID 當標題", () => {
    const [ev] = parseIcsText(
      wrap("UID:a@fixture.hotel-pm.test", "DTSTART;VALUE=DATE:20270701", "DTEND;VALUE=DATE:20270703"),
    );
    expect(ev.summary).toBe("a@fixture.hotel-pm.test");
  });
  it("AC-007 空內容拋 IcsParseError", () => {
    expect(() => parseIcsText("")).toThrow(IcsParseError);
    expect(() => parseIcsText("   \n  ")).toThrow(IcsParseError);
  });
  it("AC-007 不是 ICS 的文字（例如 HTML 錯誤頁）回空陣列", () => {
    expect(parseIcsText("<html><body>Not Found</body></html>")).toEqual([]);
  });
  it("AC-007 無效的日期格式拋 IcsParseError", () => {
    expect(() =>
      parseIcsText(wrap("UID:a@fixture.hotel-pm.test", "DTSTART:2027", "DTEND;VALUE=DATE:20270703")),
    ).toThrow(IcsParseError);
    expect(() =>
      parseIcsText(wrap("UID:a@fixture.hotel-pm.test", "DTSTART:abcdefgh", "DTEND;VALUE=DATE:20270703")),
    ).toThrow(IcsParseError);
  });
  it("AC-007 屬性名稱不分大小寫；VEVENT 以外的屬性不影響結果", () => {
    const text = [
      "BEGIN:VCALENDAR",
      "UID:calendar-level-uid-should-be-ignored",
      "BEGIN:VEVENT",
      "uid:lower@fixture.hotel-pm.test",
      "dtstart;value=date:20270701",
      "dtend;value=date:20270703",
      "summary:測試旅客H",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    expect(parseIcsText(text)).toEqual([
      {
        uid: "lower@fixture.hotel-pm.test",
        summary: "測試旅客H",
        checkIn: new Date("2027-07-01T00:00:00.000Z"),
        checkOut: new Date("2027-07-03T00:00:00.000Z"),
      },
    ]);
  });
});

describe("AC-007 時間欄位格式錯誤", () => {
  const ics = (dtstart: string) =>
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:fake-bad-time@fixture.hotel-pm.test",
      `DTSTART:${dtstart}`,
      "DTEND:20261220T110000Z",
      "SUMMARY:Reserved",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

  it("AC-007 時間不是數字時拋 IcsParseError（不產生 Invalid Date）", () => {
    expect(() => parseIcsText(ics("20261215TXXXXXX"))).toThrow(IcsParseError);
    expect(() => parseIcsText(ics("20261215T15XX00Z"))).toThrow(IcsParseError);
  });

  it("AC-007 日期不是數字時拋 IcsParseError", () => {
    expect(() => parseIcsText(ics("2026AB15"))).toThrow(IcsParseError);
  });
});
