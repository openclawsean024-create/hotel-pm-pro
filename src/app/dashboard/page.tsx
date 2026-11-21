// app/dashboard/page.tsx — Operations Dashboard
// Visual direction adopted 2026-09-24 per docs/ui-redesign-review-2026-09-24.md
// Loads data from /api/dashboard/summary and renders an Operations Dashboard.
import { auth } from "@/lib/auth";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { loadDashboardPreload, type DashboardPreload } from "@/lib/dashboard-preload";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // 伺服器端預載物業與方案，讓第一次繪製不會閃一下空狀態（AC-009 缺陷 1）。
  // 預載失敗時不讓整頁壞掉，但要記錄錯誤並告訴使用者，不能假裝「沒有物業」。
  let preload: DashboardPreload = { properties: [], user: null };
  let preloadFailed = false;
  try {
    preload = await loadDashboardPreload(session.user.id);
  } catch (err) {
    preloadFailed = true;
    // 只記錄錯誤類型與訊息，不輸出查詢參數或個資。
    console.error(
      "[dashboard] 伺服器端預載失敗：",
      err instanceof Error ? `${err.name}: ${err.message}` : "unknown error",
    );
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
          email: session.user.email ?? preload.user?.email ?? null,
          name: session.user.name ?? preload.user?.name ?? null,
        }}
        tier={(preload.user?.tier ?? "free") as "free" | "pro" | "business"}
        properties={preload.properties}
        preloadFailed={preloadFailed}
      />
    </Suspense>
  );
}
