// app/dashboard/page.tsx — Operations Dashboard (rewrite)
// AC: A1–A4, B1–B4, C1–C8, D1–D7, E1–E7
"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav";
import { AlertStrip } from "@/components/dashboard/AlertStrip";
import { KpiStrip } from "@/components/dashboard/KpiStrip";
import { RoomGrid } from "@/components/dashboard/RoomGrid";
import { TodayTimeline } from "@/components/dashboard/TodayTimeline";
import { Workbench } from "@/components/dashboard/Workbench";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { PropertyPerformanceList } from "@/components/dashboard/PropertyPerformance";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { IconMenu, IconRefresh } from "@/components/dashboard/icons";

import type { DashboardSummary } from "@/components/dashboard/types";

function useQueryString() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get("propertyId");
  return propertyId && propertyId.length > 0 ? propertyId : null;
}

export default function DashboardPage() {
  // Next.js 16 requires useSearchParams() callers to be wrapped in a Suspense
  // boundary so that prerendering can bail out cleanly. Inner page body lives
  // in <DashboardInner /> below.
  return (
    <Suspense fallback={<DashboardLoadingShell />}>
      <DashboardInner />
    </Suspense>
  );
}

function DashboardLoadingShell() {
  return (
    <div className="ops-shell" data-testid="ops-dashboard">
      <header className="ops-topbar border-b border-[var(--border)]">
        <div className="container-page flex items-center justify-between py-4">
          <Link href="/" className="text-lg font-semibold">
            <span className="gradient-text">民宿管家</span>
          </Link>
          <span className="muted text-sm">載入中…</span>
        </div>
      </header>
      <main className="ops-main container-page py-8" aria-label="營運總覽">
        <DashboardSkeleton />
      </main>
    </div>
  );
}

function DashboardInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const propertyId = useQueryString();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Session guard (D1) — preserve existing redirect-to-login behavior
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Single source of truth (D2/D3): fetch /api/dashboard/summary only.
  // Property switcher reads the `properties` field of the same response,
  // so the dashboard never re-queries /api/properties, /api/bookings,
  // /api/requirements, /api/maintenance, or /api/reports/monthly.
  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : "";
      const res = await fetch(`/api/dashboard/summary${qs}`, {
        cache: "no-store",
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        throw new Error(`伺服器回應 ${res.status}`);
      }
      const data: DashboardSummary = await res.json();
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [propertyId, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadSummary();
  }, [status, propertyId, loadSummary]);

  // Convenience derived list (always read from summary; empty until first fetch)
  const properties = summary?.properties ?? [];

  const tier = (session?.user as { tier?: string } | undefined)?.tier ?? "free";

  const propertyNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of properties) map[p.id] = p.name;
    return map;
  }, [properties]);

  const activePropertyName = propertyId
    ? properties.find((p) => p.id === propertyId)?.name ?? null
    : null;

  const initialLoading = status === "loading";
  const showSkeleton = initialLoading || (loading && !summary && !error);

  return (
    <div className="ops-shell" data-testid="ops-dashboard">
      {/* Existing top header (AC §A4 — preserved verbatim, no duplication) */}
      <header className="ops-topbar border-b border-[var(--border)]">
        <div className="container-page flex items-center justify-between py-4 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="text-lg font-semibold shrink-0">
              <span className="gradient-text">民宿管家</span>
            </Link>
            <span className="ops-breadcrumb shrink-0">
              <span aria-hidden="true">/</span> 總覽
            </span>
            {activePropertyName && (
              <span
                className="ops-scope-chip"
                aria-label={`目前管理範圍：${activePropertyName}`}
                title={activePropertyName}
              >
                {activePropertyName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm text-[var(--text-secondary)] truncate max-w-[180px]">
              {session?.user?.email}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] font-semibold">
              {tier}
            </span>
            {tier === "free" && (
              <Link href="/pricing" className="btn-primary text-sm">
                升級
              </Link>
            )}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="btn-ghost text-sm"
              aria-label="登出"
            >
              登出
            </button>
          </div>
        </div>
      </header>

      {/* Body: desktop = sidebar + main; mobile = main only */}
      <div className="ops-body">
        <Sidebar properties={properties} activePropertyId={propertyId} />

        <main className="ops-main container-page py-8" aria-label="營運總覽">
          <div className="ops-page-heading">
            <div>
              <p className="eyebrow">Operations</p>
              <h1 className="ops-title">營運總覽</h1>
              <p className="ops-description">
                今天的入住、退房、清潔、維修、本月營收與物業表現。
              </p>
            </div>
            <div className="ops-heading-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => loadSummary()}
                aria-label="重新整理總覽"
                disabled={loading}
              >
                <span aria-hidden="true">
                  <IconRefresh />
                </span>
                重新整理
              </button>
            </div>
          </div>

          {/* Loading skeleton */}
          {showSkeleton && <DashboardSkeleton />}

          {/* Error state */}
          {!showSkeleton && error && (
            <div className="ops-error" role="alert">
              <div className="ops-error-copy">
                <strong>無法載入總覽</strong>
                <span className="muted">{error}</span>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => loadSummary()}
              >
                重試
              </button>
            </div>
          )}

          {/* Empty state — no properties at all */}
          {!showSkeleton && !error && summary && properties.length === 0 && (
            <div className="ops-empty" role="status">
              <h2 className="ops-empty-title">還沒有任何物業</h2>
              <p className="ops-empty-copy">
                建立第一個物業後，總覽就會自動顯示今天的入住、退房、營收與待辦。
              </p>
              <Link href="/dashboard/properties" className="btn-primary">
                新增第一個物業
              </Link>
            </div>
          )}

          {/* Loaded dashboard */}
          {!showSkeleton && !error && summary && properties.length > 0 && (
            <>
              <AlertStrip
                cleaning={summary.occupancy.cleaning}
                maintenance={summary.occupancy.maintenance}
                openCases={summary.kpi.openCases}
              />
              <KpiStrip
                checkInsToday={summary.kpi.checkInsToday}
                checkOutsToday={summary.kpi.checkOutsToday}
                revenueMonth={summary.kpi.revenueMonth}
                openCases={summary.kpi.openCases}
              />

              <div className="ops-grid-2">
                <RoomGrid rooms={summary.rooms} occupancy={summary.occupancy} />
                <TodayTimeline items={summary.timeline} />
              </div>

              <Workbench
                items={summary.workbench}
                propertyNameById={propertyNameById}
              />

              <div className="ops-grid-2">
                <RevenueChart series={summary.revenueSeries} />
                <PropertyPerformanceList
                  rows={summary.propertyPerformance}
                />
              </div>

              <QuickActions />
            </>
          )}
        </main>
      </div>

      <MobileBottomNav />

      {/* SR-only menu trigger retained for parity with prototype IA */}
      <button type="button" className="sr-only" aria-hidden="true" tabIndex={-1}>
        <IconMenu />
      </button>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="ops-skeleton" aria-busy="true" aria-live="polite">
      <div className="ops-skeleton-row skeleton-strip" />
      <div className="ops-kpi-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="skeleton-card" key={`kpi-${i}`} />
        ))}
      </div>
      <div className="ops-grid-2">
        <div className="skeleton-card tall" />
        <div className="skeleton-card tall" />
      </div>
      <div className="skeleton-card tall" />
      <div className="ops-grid-2">
        <div className="skeleton-card" />
        <div className="skeleton-card" />
      </div>
    </div>
  );
}
