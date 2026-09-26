// app/dashboard/page.tsx — Operations Dashboard
// Visual direction adopted 2026-09-24 per docs/ui-redesign-review-2026-09-24.md
// Preserves PRD/SPEC §1.3 scope: no OTA channel manager, hardware, payments,
// or other new back-end surface. Loads data from /api/dashboard/summary
// (existing) and renders an Operations Dashboard with international SaaS
// visual language (graphite nav, orange action, violet analytics, neutral
// canvas).
import { auth } from "@/lib/auth";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { pgQuery } from "@/lib/pg-client";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

type PropertyRow = {
  id: string;
  name: string;
  roomType: string;
  roomsCount: number;
  ownerShare: number | null; // 0..100 (Int in DB)
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Read the portfolio + tier so the first paint avoids a flash of empty state.
  // Stays within SPEC §1.3: the page keeps parity with the existing
  // /api/dashboard/summary route and only adds a server-side prefetch.
  let properties: PropertyRow[] = [];
  let userRow: { tier: string | null; name: string | null; email: string | null } | null = null;
  try {
    [properties, userRow] = await Promise.all([
      pgQuery<PropertyRow>(
        `SELECT p.id,
                p.name,
                p."roomType" AS "roomType",
                COALESCE((SELECT COUNT(*) FROM "Room" r WHERE r."propertyId" = p.id), 0)::int AS "roomsCount",
                p."ownerShare" AS "ownerShare"
           FROM "Property" p
          WHERE p."userId" = $1
          ORDER BY p.name ASC
          LIMIT 200`,
        [session.user.id],
      ),
      pgQuery<{ tier: string; name: string | null; email: string }>(
        `SELECT tier, name, email FROM "User" WHERE id = $1 LIMIT 1`,
        [session.user.id],
      ).then((rows) => rows[0] ?? null),
    ]);
  } catch {
    // Demo environment / pg unreachable — fall back to empty state rather than crash.
    properties = [];
    userRow = null;
  }

  return (
    <Suspense
      fallback={
        <main className="ops-main" aria-label="營運總覽載入中">
          <div className="skeleton-card" aria-hidden="true" />
        </main>
      }
    >
      <DashboardClient
        user={{
          email: session.user.email ?? userRow?.email ?? null,
          name: session.user.name ?? userRow?.name ?? null,
        }}
        tier={(userRow?.tier ?? "free") as "free" | "pro" | "business"}
        properties={properties}
      />
    </Suspense>
  );
}
