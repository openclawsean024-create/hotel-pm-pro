// app/api/dashboard/summary/route.ts
// Operations Dashboard single-source-of-truth endpoint.
// Session-protected (NextAuth via existing `auth()` helper).
// Returns KPI / occupancy / rooms / today timeline / workbench /
// revenue series (last 6 months) / per-property performance in one round-trip.

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { pgQuery } from "@/lib/pg-client";

// ----- Query validation (D7) -----
const querySchema = z.object({
  propertyId: z.string().min(1).optional(),
  // YYYY-MM; Zod regex enforces shape
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "month 必須為 YYYY-MM")
    .optional(),
});

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const CATEGORY_LABEL: Record<string, string> = {
  repair: "維修",
  special_request: "特殊需求",
  cleaning_note: "清潔備註",
  other: "其他",
};

// ----- Date helpers (Asia/Taipei anchored) -----
function taipeiTodayISO(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function shiftDateISO(iso: string, days: number): string {
  // iso = "YYYY-MM-DD"; produce iso + days.
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function nextMonthISO(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function lastNMonths(endMonth: string, n: number): string[] {
  const [y, m] = endMonth.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(
      `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`
    );
  }
  return out;
}

// ----- Room state derivation (C2) -----
type RoomState =
  | "empty"
  | "occupied"
  | "checkout_today"
  | "cleaning"
  | "maintenance";

function deriveRoomState(
  propertyId: string,
  todayStr: string,
  yesterdayStr: string,
  bookings: { propertyId: string; checkIn: string; checkOut: string }[],
  activeMaint: Set<string>
): RoomState {
  if (activeMaint.has(propertyId)) return "maintenance";

  const todays = bookings.filter(
    (b) =>
      b.propertyId === propertyId &&
      String(b.checkIn).slice(0, 10) <= todayStr &&
      String(b.checkOut).slice(0, 10) > todayStr
  );
  if (todays.length > 0) {
    const isCheckout = todays.some(
      (b) => String(b.checkOut).slice(0, 10) === todayStr
    );
    return isCheckout ? "checkout_today" : "occupied";
  }

  const yesterdaysCheckout = bookings.some(
    (b) =>
      b.propertyId === propertyId &&
      String(b.checkOut).slice(0, 10) === yesterdayStr
  );
  const todayCheckin = bookings.some(
    (b) =>
      b.propertyId === propertyId &&
      String(b.checkIn).slice(0, 10) === todayStr
  );
  if (yesterdaysCheckout && !todayCheckin) return "cleaning";

  return "empty";
}

// ----- API handler -----
export async function GET(req: Request) {
  // Session guard (D2 / D7 → 401)
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  // Query validation (D7 → 400)
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    propertyId: searchParams.get("propertyId") ?? undefined,
    month: searchParams.get("month") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "驗證失敗" },
      { status: 400 }
    );
  }
  const userId = session.user.id;
  const propertyFilter = parsed.data.propertyId;
  const todayStr = taipeiTodayISO();
  const yesterdayStr = shiftDateISO(todayStr, -1);
  const monthParam = parsed.data.month ?? todayStr.slice(0, 7);
  const monthStart = `${monthParam}-01`;
  const monthEnd = `${nextMonthISO(monthParam)}-01`;
  const trendMonths = lastNMonths(monthParam, 6);

  // ----- Properties in scope -----
  const properties = await pgQuery<{
    id: string;
    name: string;
    roomType: string;
    monthlyRent: number;
    ownerShare: number;
  }>(
    `SELECT id, name, "roomType", "monthlyRent", "ownerShare"
       FROM "Property"
      WHERE "userId" = $1
        ${propertyFilter ? `AND id = $2` : ""}
      ORDER BY "createdAt"`,
    propertyFilter ? [userId, propertyFilter] : [userId]
  );

  const emptyResponse = {
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      roomType: p.roomType,
    })),
    kpi: { checkInsToday: 0, checkOutsToday: 0, revenueMonth: 0, openCases: 0 },
    occupancy: { rate: 0, available: 0, occupied: 0, cleaning: 0, maintenance: 0 },
    rooms: [],
    timeline: [],
    workbench: [],
    revenueSeries: trendMonths.map((m) => ({ month: m, total: 0 })),
    propertyPerformance: [],
  };

  if (properties.length === 0) {
    return NextResponse.json(emptyResponse);
  }

  const propertyIds = properties.map((p) => p.id);
  const propertyIdParam = propertyIds;

  // ----- KPI: today check-ins / check-outs -----
  const checkInsTodayRes = await pgQuery<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM "Booking"
      WHERE "userId" = $1
        AND "propertyId" = ANY($2::text[])
        AND status <> 'cancelled'
        AND "checkIn" >= $3 AND "checkIn" < $4`,
    [userId, propertyIdParam, todayStr, shiftDateISO(todayStr, 1)]
  );
  const checkOutsTodayRes = await pgQuery<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM "Booking"
      WHERE "userId" = $1
        AND "propertyId" = ANY($2::text[])
        AND status <> 'cancelled'
        AND "checkOut" >= $3 AND "checkOut" < $4`,
    [userId, propertyIdParam, todayStr, shiftDateISO(todayStr, 1)]
  );

  // ----- KPI: revenueMonth (sum totalPrice in month, all statuses except cancelled) -----
  const revenueMonthRes = await pgQuery<{ total: string | null }>(
    `SELECT COALESCE(SUM("totalPrice"), 0)::text AS total
       FROM "Booking"
      WHERE "userId" = $1
        AND "propertyId" = ANY($2::text[])
        AND status <> 'cancelled'
        AND "checkIn" >= $3 AND "checkIn" < $4`,
    [userId, propertyIdParam, monthStart, monthEnd]
  );

  // ----- KPI: openCases (Requirement open/in_progress + Maintenance pending/in_progress) -----
  const openReqRes = await pgQuery<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM "Requirement"
      WHERE "userId" = $1
        AND "propertyId" = ANY($2::text[])
        AND status IN ('open', 'in_progress')`,
    [userId, propertyIdParam]
  );
  const openMaintRes = await pgQuery<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM "Maintenance"
      WHERE "userId" = $1
        AND "propertyId" = ANY($2::text[])
        AND status IN ('pending', 'in_progress')`,
    [userId, propertyIdParam]
  );

  // ----- Pull today's bookings + yesterday's checkouts for room derivation -----
  const relevantBookings = await pgQuery<{
    id: string;
    propertyId: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
  }>(
    `SELECT id, "propertyId", "guestName", "checkIn", "checkOut"
       FROM "Booking"
      WHERE "userId" = $1
        AND "propertyId" = ANY($2::text[])
        AND status <> 'cancelled'
        AND "checkOut" >= $3 AND "checkIn" <= $4`,
    [userId, propertyIdParam, yesterdayStr, todayStr]
  );

  // ----- Active maintenance (for "maintenance" room state) -----
  const activeMaintRes = await pgQuery<{ propertyId: string }>(
    `SELECT DISTINCT "propertyId"
       FROM "Maintenance"
      WHERE "userId" = $1
        AND "propertyId" = ANY($2::text[])
        AND status IN ('pending', 'in_progress')
        AND "startDate" <= $3
        AND ("completedAt" IS NULL OR "completedAt" > $3)`,
    [userId, propertyIdParam, todayStr]
  );
  const activeMaintSet = new Set(activeMaintRes.map((m) => m.propertyId));

  // ----- Build rooms[] + occupancy -----
  const rooms = properties.map((p) => {
    const state = deriveRoomState(
      p.id,
      todayStr,
      yesterdayStr,
      relevantBookings,
      activeMaintSet
    );
    return {
      id: p.id,
      name: p.name,
      roomType: p.roomType,
      state,
      propertyId: p.id,
    };
  });

  const occupancyCount = {
    occupied: rooms.filter((r) => r.state === "occupied" || r.state === "checkout_today").length,
    cleaning: rooms.filter((r) => r.state === "cleaning").length,
    maintenance: rooms.filter((r) => r.state === "maintenance").length,
  };
  const totalRooms = rooms.length;
  const available = Math.max(0, totalRooms - occupancyCount.occupied - occupancyCount.cleaning - occupancyCount.maintenance);
  const rate = totalRooms === 0
    ? 0
    : Math.round((occupancyCount.occupied / totalRooms) * 100);

  // ----- Timeline (C3): today's check-ins, check-outs, cleaning markers, maintenance events -----
  type TimelineItem = {
    time: string;
    type: "checkin" | "checkout" | "cleaning" | "maintenance";
    propertyId: string;
    meta: string;
    pill: { label: string; tone: "ready" | "pending" | "blocked" | "info" };
  };

  const propNameById = new Map(properties.map((p) => [p.id, p.name]));
  const timeline: TimelineItem[] = [];

  for (const b of relevantBookings) {
    const ci = String(b.checkIn).slice(0, 10);
    const co = String(b.checkOut).slice(0, 10);
    const propName = propNameById.get(b.propertyId) ?? "—";
    if (ci === todayStr) {
      timeline.push({
        time: "15:00",
        type: "checkin",
        propertyId: b.propertyId,
        meta: `${b.guestName} · ${propName}`,
        pill: { label: "入住", tone: "ready" },
      });
    }
    if (co === todayStr) {
      timeline.push({
        time: "11:00",
        type: "checkout",
        propertyId: b.propertyId,
        meta: `${b.guestName} · ${propName}`,
        pill: { label: "退房", tone: "info" },
      });
    }
    if (co === yesterdayStr) {
      // Yesterday's checkout that has no same-day follow-up booking → cleaning
      const hasFollowUp = relevantBookings.some(
        (other) =>
          other.propertyId === b.propertyId &&
          String(other.checkIn).slice(0, 10) === todayStr
      );
      if (!hasFollowUp) {
        timeline.push({
          time: "12:00",
          type: "cleaning",
          propertyId: b.propertyId,
          meta: propName,
          pill: { label: "待清潔", tone: "pending" },
        });
      }
    }
  }

  // Maintenance events active today
  const todayMaintEvents = await pgQuery<{
    id: string;
    title: string;
    propertyId: string;
  }>(
    `SELECT id, title, "propertyId"
       FROM "Maintenance"
      WHERE "userId" = $1
        AND "propertyId" = ANY($2::text[])
        AND status IN ('pending', 'in_progress')
        AND "startDate" <= $3
        AND ("completedAt" IS NULL OR "completedAt" > $3)`,
    [userId, propertyIdParam, todayStr]
  );
  for (const m of todayMaintEvents) {
    const propName = propNameById.get(m.propertyId) ?? "—";
    timeline.push({
      time: "09:00",
      type: "maintenance",
      propertyId: m.propertyId,
      meta: `${m.title} · ${propName}`,
      pill: { label: "維修中", tone: "blocked" },
    });
  }

  // Sort ascending by time (already deterministic insertion order; sort defensively)
  timeline.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));

  // ----- Workbench (C4): top 5 open items by priority then createdAt desc -----
  type WorkbenchItem = {
    id: string;
    kind: "requirement" | "maintenance";
    title: string;
    propertyId: string;
    priority: "low" | "normal" | "high" | "urgent";
    dueAt: string | null;
    status: string;
  };

  const openReqs = await pgQuery<{
    id: string;
    title: string;
    propertyId: string;
    priority: string;
    status: string;
    createdAt: string;
  }>(
    `SELECT id, title, "propertyId", priority, status, "createdAt"
       FROM "Requirement"
      WHERE "userId" = $1
        AND "propertyId" = ANY($2::text[])
        AND status IN ('open', 'in_progress')`,
    [userId, propertyIdParam]
  );

  const openMaints = await pgQuery<{
    id: string;
    title: string;
    propertyId: string;
    estimatedCost: number;
    status: string;
    endDate: string | null;
    createdAt: string;
  }>(
    `SELECT id, title, "propertyId", "estimatedCost", status, "endDate", "createdAt"
       FROM "Maintenance"
      WHERE "userId" = $1
        AND "propertyId" = ANY($2::text[])
        AND status IN ('pending', 'in_progress')`,
    [userId, propertyIdParam]
  );

  // Maintenance has no explicit "priority" field — treat as "normal" for sorting
  const reqsMapped: WorkbenchItem[] = openReqs.map((r) => ({
    id: r.id,
    kind: "requirement" as const,
    title: r.title,
    propertyId: r.propertyId,
    priority: (r.priority as WorkbenchItem["priority"]) ?? "normal",
    dueAt: null,
    status: r.status,
  }));
  const maintsMapped: WorkbenchItem[] = openMaints.map((m) => ({
    id: m.id,
    kind: "maintenance" as const,
    title: m.title,
    propertyId: m.propertyId,
    priority: "normal" as const,
    dueAt: m.endDate ?? null,
    status: m.status,
  }));

  const allWorkbench = [...reqsMapped, ...maintsMapped]
    .map((w) => ({
      ...w,
      _rank: PRIORITY_RANK[w.priority] ?? 9,
      _createdAt:
        w.kind === "requirement"
          ? openReqs.find((r) => r.id === w.id)?.createdAt ?? ""
          : openMaints.find((m) => m.id === w.id)?.createdAt ?? "",
    }))
    .sort((a, b) => {
      if (a._rank !== b._rank) return a._rank - b._rank;
      return a._createdAt < b._createdAt ? 1 : a._createdAt > b._createdAt ? -1 : 0;
    })
    .slice(0, 5)
    .map(({ _rank, _createdAt, ...w }) => w);

  // ----- Revenue series (C5): last 6 months, current month highlighted by ordering -----
  const trendStart = `${trendMonths[0]}-01`;
  const trendEnd = `${nextMonthISO(trendMonths[trendMonths.length - 1])}-01`;
  const trendBookings = await pgQuery<{
    total: string;
    monthPrefix: string;
  }>(
    `SELECT COALESCE(SUM("totalPrice"), 0)::text AS total,
            to_char("checkIn" AT TIME ZONE 'UTC', 'YYYY-MM') AS "monthPrefix"
       FROM "Booking"
      WHERE "userId" = $1
        AND "propertyId" = ANY($2::text[])
        AND status <> 'cancelled'
        AND "checkIn" >= $3 AND "checkIn" < $4
      GROUP BY "monthPrefix"`,
    [userId, propertyIdParam, trendStart, trendEnd]
  );
  const trendMap = new Map(trendBookings.map((r) => [r.monthPrefix, Number(r.total)]));
  const revenueSeries = trendMonths.map((m) => ({
    month: m,
    total: trendMap.get(m) ?? 0,
  }));

  // ----- Property performance (C5): per-property MTD revenue + occupancy proxy -----
  type PropertyPerformance = {
    id: string;
    name: string;
    mtdRevenue: number;
    occupancy: number;
  };

  const mtdByPropRes = await pgQuery<{
    propertyId: string;
    total: string;
  }>(
    `SELECT "propertyId", COALESCE(SUM("totalPrice"), 0)::text AS total
       FROM "Booking"
      WHERE "userId" = $1
        AND "propertyId" = ANY($2::text[])
        AND status <> 'cancelled'
        AND "checkIn" >= $3 AND "checkIn" < $4
      GROUP BY "propertyId"`,
    [userId, propertyIdParam, monthStart, monthEnd]
  );
  const mtdMap = new Map(mtdByPropRes.map((r) => [r.propertyId, Number(r.total)]));

  const propertyPerformance: PropertyPerformance[] = properties.map((p) => {
    const propRooms = rooms.filter((r) => r.propertyId === p.id);
    const occupiedCount = propRooms.filter(
      (r) => r.state === "occupied" || r.state === "checkout_today"
    ).length;
    const occupancy =
      propRooms.length === 0
        ? 0
        : Math.round((occupiedCount / propRooms.length) * 100);
    return {
      id: p.id,
      name: p.name,
      mtdRevenue: mtdMap.get(p.id) ?? 0,
      occupancy,
    };
  });

  // ----- Final response -----
  const total = (r: { count: string } | undefined) =>
    r ? Number(r.count) : 0;

  return NextResponse.json({
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      roomType: p.roomType,
    })),
    kpi: {
      checkInsToday: total(checkInsTodayRes[0]),
      checkOutsToday: total(checkOutsTodayRes[0]),
      revenueMonth: Number(revenueMonthRes[0]?.total ?? 0),
      openCases: total(openReqRes[0]) + total(openMaintRes[0]),
    },
    occupancy: {
      rate,
      available,
      occupied: occupancyCount.occupied,
      cleaning: occupancyCount.cleaning,
      maintenance: occupancyCount.maintenance,
    },
    rooms,
    timeline,
    workbench: allWorkbench.map((w) => ({
      ...w,
      kindLabel:
        w.kind === "requirement"
          ? CATEGORY_LABEL["other"]
          : "派工",
    })),
    revenueSeries,
    propertyPerformance,
  });
}
