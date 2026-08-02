// app/api/reports/monthly/route.ts — F-M6 月報表 + 房東分潤自動拆帳
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pgQuery } from "@/lib/pg-client";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month"); // YYYY-MM

  if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
    return NextResponse.json({ error: "請提供 YYYY-MM 格式月份" }, { status: 400 });
  }

  const [year, month] = monthParam.split("-").map(Number);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 1).toISOString().slice(0, 10); // 下月 1 號（exclusive）

  // 拉所有 properties + 房東分潤
  const properties = await pgQuery<any>(
    `SELECT id, name, "monthlyRent", "ownerShare"
     FROM "Property"
     WHERE "userId" = $1
     ORDER BY "createdAt"`,
    [session.user.id]
  );

  // 拉這個月所有 bookings（訂房收入）
  const bookings = await pgQuery<any>(
    `SELECT id, "guestName", "propertyId", "checkIn", "checkOut", channel, "totalPrice"
     FROM "Booking"
     WHERE "userId" = $1
       AND status = 'completed'
       AND "checkIn" >= $2
       AND "checkIn" < $3`,
    [session.user.id, startDate, endDate]
  );

  // 計算每物業
  const report = properties.map((p) => {
    const propBookings = bookings.filter((b) => b.propertyId === p.id);
    const bookingRevenue = propBookings.reduce((s, b) => s + b.totalPrice, 0);
    const totalIncome = p.monthlyRent + bookingRevenue;
    const ownerShareAmount = Math.round((totalIncome * p.ownerShare) / 100);
    const operatorShare = totalIncome - ownerShareAmount;

    return {
      propertyId: p.id,
      propertyName: p.name,
      monthlyRent: p.monthlyRent,
      ownerSharePercent: p.ownerShare,
      bookingRevenue,
      bookingCount: propBookings.length,
      totalIncome,
      ownerShareAmount,
      operatorShare,
      bookings: propBookings.map((b) => ({
        id: b.id,
        guestName: b.guestName,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        channel: b.channel,
        totalPrice: b.totalPrice,
      })),
    };
  });

  const totalRevenue = report.reduce((s, r) => s + r.totalIncome, 0);
  const totalOwnerShare = report.reduce((s, r) => s + r.ownerShareAmount, 0);
  const totalOperatorShare = report.reduce((s, r) => s + r.operatorShare, 0);

  return NextResponse.json({
    month: monthParam,
    properties: report,
    summary: {
      totalRevenue,
      totalOwnerShare,
      totalOperatorShare,
      propertyCount: properties.length,
    },
  });
}
