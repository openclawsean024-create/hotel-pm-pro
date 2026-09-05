// lib/ics-parser.ts — F-M9 ICS 解析器
// 純函式，無外部依賴。支援 RFC 5545 子集（Airbnb / Booking.com iCal 格式）
// 不支援的時區會拋 IcsParseError；無 UID / DTSTART / DTEND 的 event 會靜默略過。

export interface IcsEvent {
  uid: string;
  summary: string;
  checkIn: Date;
  checkOut: Date;
}

export class IcsParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IcsParseError";
  }
}

interface ParsedProperty {
  name: string;
  params: Map<string, string>;
  value: string;
}

// ========== Public API ==========

export function parseIcsText(text: string): IcsEvent[] {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new IcsParseError("ICS 內容為空");
  }

  const lines = unfold(text);
  const events: IcsEvent[] = [];
  let inEvent = false;
  let currentProps: ParsedProperty[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      inEvent = true;
      currentProps = [];
      continue;
    }
    if (trimmed === "END:VEVENT") {
      if (inEvent) {
        const ev = buildEvent(currentProps);
        if (ev) events.push(ev);
      }
      inEvent = false;
      currentProps = [];
      continue;
    }
    if (inEvent && trimmed.length > 0) {
      currentProps.push(parseProperty(trimmed));
    }
  }

  return events;
}

// ========== Internals ==========

// 處理 CRLF / LF + line folding（CRLF + SPACE/HTAB = 上一行 continuation）
function unfold(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = normalized.split("\n");
  const out: string[] = [];
  for (const line of rawLines) {
    if (out.length > 0 && /^[ \t]/.test(line)) {
      out[out.length - 1] += line.replace(/^[ \t]+/, "");
    } else {
      out.push(line);
    }
  }
  return out;
}

// 解析 "DTSTART;TZID=Asia/Taipei:20261215" 這種 property line
function parseProperty(line: string): ParsedProperty {
  const colonIdx = line.indexOf(":");
  if (colonIdx < 0) {
    return { name: line.toUpperCase(), params: new Map(), value: "" };
  }
  const head = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1);
  const headParts = head.split(";");
  const name = headParts[0].toUpperCase();
  const params = new Map<string, string>();
  for (let i = 1; i < headParts.length; i++) {
    const eq = headParts[i].indexOf("=");
    if (eq > 0) {
      params.set(headParts[i].slice(0, eq).toUpperCase(), headParts[i].slice(eq + 1));
    }
  }
  return { name, params, value };
}

// RFC 5545 §3.3.11 文字跳脫
function unescapeIcsText(s: string): string {
  return s
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function buildEvent(props: ParsedProperty[]): IcsEvent | null {
  let uid: string | null = null;
  let summary = "";
  let description = "";
  let dtstart: ParsedProperty | null = null;
  let dtend: ParsedProperty | null = null;

  for (const p of props) {
    if (p.name === "UID") {
      uid = p.value.trim();
    } else if (p.name === "SUMMARY") {
      summary = unescapeIcsText(p.value);
    } else if (p.name === "DESCRIPTION") {
      description = unescapeIcsText(p.value);
    } else if (p.name === "DTSTART") {
      dtstart = p;
    } else if (p.name === "DTEND") {
      dtend = p;
    }
  }

  if (!uid || !dtstart || !dtend) return null;
  if (!summary && description) summary = description.slice(0, 200);
  if (!summary) summary = uid;

  // parseIcsDate 拋出 IcsParseError 時必須 re-throw（不合法的時區或日期格式
  // 代表整個 ICS 不可信，交給上層回 400），不可以用 return null 吞掉。
  // 退房日 <= 入住日是合法但無意義的 event，安靜略過即可。
  const checkIn = parseIcsDate(dtstart.value, dtstart.params);
  const checkOut = parseIcsDate(dtend.value, dtend.params);
  if (checkOut.getTime() <= checkIn.getTime()) return null;
  return { uid, summary, checkIn, checkOut };
}

// 解析 ICS 日期（含 TIME / DATE / TZID / UTC 三種情境）
// 支援：20261215、20261215T143000Z、DTSTART;TZID=Asia/Taipei:20261215[Thhmmss]
function parseIcsDate(value: string, params: Map<string, string>): Date {
  const cleaned = value.trim();
  if (cleaned.length < 8) {
    throw new IcsParseError(`無效的 ICS 日期: ${value}`);
  }

  const year = parseInt(cleaned.slice(0, 4), 10);
  const month = parseInt(cleaned.slice(4, 6), 10);
  const day = parseInt(cleaned.slice(6, 8), 10);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    throw new IcsParseError(`無效的 ICS 日期: ${value}`);
  }

  // 判斷 DATE 還是 DATE-TIME
  const hasTime = cleaned.length >= 9 && cleaned[8] === "T";

  if (!hasTime) {
    // DATE-only
    const tzid = params.get("TZID");
    if (tzid) {
      const offsetHours = getTzOffsetHours(tzid);
      return new Date(Date.UTC(year, month - 1, day) - offsetHours * 3600 * 1000);
    }
    return new Date(Date.UTC(year, month - 1, day));
  }

  // DATE-TIME
  const timePart = cleaned.slice(9); // "HHMMSS" or "HHMMSSZ"
  if (timePart.length < 6) {
    throw new IcsParseError(`無效的 ICS 日期時間: ${value}`);
  }
  const hour = parseInt(timePart.slice(0, 2), 10);
  const minute = parseInt(timePart.slice(2, 4), 10);
  const second = parseInt(timePart.slice(4, 6), 10);

  if (timePart.endsWith("Z")) {
    // UTC
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  }

  const tzid = params.get("TZID");
  if (tzid) {
    const offsetHours = getTzOffsetHours(tzid);
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second) - offsetHours * 3600 * 1000);
  }

  // Floating time (no Z, no TZID) — 視為 UTC
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

// 簡化時區表：只回傳 UTC offset（小時）。不支援的 TZID 直接拋錯。
// 民宿管家以台灣為主，預設支援 Asia/Taipei + 鄰近東亞時區。
function getTzOffsetHours(tzid: string): number {
  const t = tzid.trim();
  if (/^Asia\/Taipei$/i.test(t)) return 8;
  if (/^Asia\/Tokyo$/i.test(t)) return 9;
  if (/^Asia\/Shanghai$/i.test(t)) return 8;
  if (/^Asia\/Hong_Kong$/i.test(t)) return 8;
  if (/^Asia\/Singapore$/i.test(t)) return 8;
  if (/^Asia\/Bangkok$/i.test(t)) return 7;
  if (/^Asia\/Manila$/i.test(t)) return 8;
  if (/^Asia\/Seoul$/i.test(t)) return 9;
  if (/^UTC$/i.test(t)) return 0;
  // POSIX Etc/GMT+N = UTC-N（注意反號）
  const m = t.match(/^Etc\/GMT([+-])(\d+)$/i);
  if (m) {
    const sign = m[1] === "+" ? -1 : 1;
    return sign * parseInt(m[2], 10);
  }
  throw new IcsParseError(`不支援的時區: ${tzid}`);
}
