// app/api/reports/monthly/route.ts — 月報表 + 房東分潤拆帳 + CSV 匯出（AC-003，FR-016／FR-018）
//
// GET /api/reports/monthly?month=YYYY-MM            → JSON
// GET /api/reports/monthly?month=YYYY-MM&format=csv → text/csv 下載
//
// 收入規則與月份邊界見 src/lib/monthly-report.ts；拆帳使用 src/lib/settlement.ts。
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pgQuery } from "@/lib/pg-client";
import { isValidMonth, taipeiMonthRangeUtc } from "@/lib/dates";
import { createCsv } from "@/lib/csv";
import {
  buildMonthlyReport,
  MonthlyReportError,
  monthlyReportToCsvRows,
  type MonthlyReport,
  type ReportBookingInput,
  type ReportPropertyInput,
} from "@/lib/monthly-report";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM
  if (!month || !isValidMonth(month)) {
    return NextResponse.json({ error: "請提供 YYYY-MM 格式月份" }, { status: 400 });
  }
  const format = searchParams.get("format") ?? "json";
  if (format !== "json" && format !== "csv") {
    return NextResponse.json({ error: "format 僅支援 json 或 csv" }, { status: 400 });
  }

  // 月份邊界以 Asia/Taipei 為準：2026-07 = [2026-06-30T16:00Z, 2026-07-31T16:00Z)
  const { start, end } = taipeiMonthRangeUtc(month);

  const properties = await pgQuery<ReportPropertyInput>(
    `SELECT id, name, "monthlyRent", "ownerShare"
       FROM "Property"
      WHERE "userId" = $1
      ORDER BY "createdAt"`,
    [session.user.id]
  );

  // 只取當月已完成的訂房；buildMonthlyReport 內會再以同樣規則過濾一次（規則有單元測試）。
  const bookings = await pgQuery<ReportBookingInput>(
    `SELECT id, "guestName", "propertyId", "checkIn", "checkOut", channel, "totalPrice", status
       FROM "Booking"
      WHERE "userId" = $1
        AND status = 'completed'
        AND "checkIn" >= $2
        AND "checkIn" < $3`,
    [session.user.id, start.toISOString(), end.toISOString()]
  );

  let report: MonthlyReport;
  try {
    report = buildMonthlyReport({ month, properties, bookings });
  } catch (err) {
    if (err instanceof MonthlyReportError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }

  if (format === "csv") {
    // 加 UTF-8 BOM，讓 Excel 直接開啟時中文不會變亂碼。
    const csv = `﻿${createCsv(monthlyReportToCsvRows(report))}`;
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="monthly-report-${month}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json(report);
}
