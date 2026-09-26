// components/dashboard/DashboardClient.tsx
// Client wrapper for the Operations Dashboard. Holds the data fetching /
// retry state and renders the new IA: topbar · sidebar · pulse · kpis ·
// timeline+queue · portfolio+settlements · actions. URL params remain the
// sole source of truth for property scope (matches existing API contract).
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { KpiStrip } from "./KpiStrip";
import { TodayTimeline } from "./TodayTimeline";
import { Workbench } from "./Workbench";
import { RevenueChart } from "./RevenueChart";
import { PropertyPerformance } from "./PropertyPerformance";
import { OwnerSettlements } from "./OwnerSettlements";
import { MobileScopeSwitcher } from "./MobileScopeSwitcher";
import { MobileBottomNav } from "./MobileBottomNav";
import {
  IconArrowUpRight,
  IconBell,
  IconBuilding,
  IconCalendar,
  IconClock,
  IconList,
  IconPlus,
  IconRefresh,
  IconSync,
  IconWrench,
} from "./icons";
import { dashboardCopy } from "./i18n";
import type {
  DashboardSummary,
  PropertyOption,
} from "./types";

type PropertyLite = {
  id: string;
  name: string;
  roomType: string;
  roomsCount: number;
  ownerShare: number | null;
};

type UserLite = { email: string | null; name: string | null };
type Tier = "free" | "pro" | "business";

async function fetchSummary(propertyId: string | null, signal?: AbortSignal): Promise<DashboardSummary> {
  const url = new URL("/api/dashboard/summary", window.location.origin);
  if (propertyId) url.searchParams.set("propertyId", propertyId);
  const res = await fetch(url.toString(), {
    method: "GET",
    credentials: "include",
    signal,
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}`);
  }
  const json = (await res.json()) as DashboardSummary;
  return json;
}

const EMPTY_SUMMARY: DashboardSummary = {
  properties: [],
  kpi: { checkInsToday: 0, checkOutsToday: 0, revenueMonth: 0, openCases: 0 },
  occupancy: { rate: 0, available: 0, occupied: 0, cleaning: 0, maintenance: 0 },
  rooms: [],
  timeline: [],
  workbench: [],
  revenueSeries: [],
  propertyPerformance: [],
};

function occupanciesByProperty(summary: DashboardSummary): Record<string, number> {
  // API returns occupancy as a 0..100 integer (rate).
  const result: Record<string, number> = {};
  summary.propertyPerformance.forEach((p) => {
    result[p.id] = (p.occupancy ?? 0) / 100;
  });
  return result;
}

function totalMtdRevenue(summary: DashboardSummary): number {
  return summary.propertyPerformance.reduce((acc, p) => acc + (p.mtdRevenue ?? 0), 0);
}

function propertiesForSettlement(properties: PropertyLite[], summary: DashboardSummary) {
  return properties.map((p) => {
    const perf = summary.propertyPerformance.find((x) => x.id === p.id);
    return {
      id: p.id,
      name: p.name,
      ownerShare: p.ownerShare != null ? p.ownerShare / 100 : null,
      mtdRevenue: perf?.mtdRevenue ?? null,
      roomsCount: p.roomsCount,
    };
  });
}

function todayDateInTaipei(): string {
  try {
    return new Intl.DateTimeFormat("zh-TW", {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Taipei",
    }).format(new Date());
  } catch {
    return new Date().toDateString();
  }
}

export function DashboardClient({
  user,
  tier,
  properties,
}: {
  user: UserLite;
  tier: Tier;
  properties: PropertyLite[];
}) {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get("propertyId");
  const t = dashboardCopy;

  const activePropertyName = useMemo(() => {
    if (!propertyId) return null;
    return properties.find((p) => p.id === propertyId)?.name ?? null;
  }, [propertyId, properties]);

  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchSummary(propertyId);
        setSummary(data);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setError((err as Error).message || "fetch failed");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [propertyId],
  );

  useEffect(() => {
    load("initial");
  }, [load]);

  const handleRefresh = useCallback(() => {
    load("refresh");
  }, [load]);

  const occupancies = useMemo(() => occupanciesByProperty(summary), [summary]);
  const totalMtd = useMemo(() => totalMtdRevenue(summary), [summary]);
  const settlementProps = useMemo(
    () => propertiesForSettlement(properties, summary),
    [properties, summary],
  );
  const openCases = summary.kpi.openCases;
  const todayDate = todayDateInTaipei();

  const syncState = error
    ? "同步失敗"
    : refreshing
      ? "同步中…"
      : loading
        ? "載入中…"
        : "已同步 · Asia/Taipei";

  return (
    <div
      className="ops-shell"
      data-testid="dashboard-shell"
      data-scope={propertyId ?? "all"}
      data-tier={tier}
    >
      <Sidebar
        properties={properties as PropertyOption[]}
        activePropertyId={propertyId}
        openCases={openCases}
      />

      <div className="ops-body" style={{ flex: 1, minWidth: 0 }}>
        <Topbar
          user={user}
          tier={tier}
          activePropertyName={activePropertyName}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          pageTitle={t.page.title}
        />

        <main className="ops-main" aria-labelledby="dashboard-title" role="main">
          {/* Page heading + actions */}
          <div className="ops-page-heading">
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="eyebrow">
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: "var(--canopy-orange)",
                    marginRight: 6,
                    verticalAlign: "middle",
                  }}
                  aria-hidden={true}
                />
                {t.page.eyebrow}
              </p>
              <h1 id="dashboard-title" className="ops-title">
                {t.page.title}
              </h1>
              <p className="ops-description">{t.page.description}</p>
            </div>
            <div className="ops-heading-actions">
              <span
                aria-live="polite"
                aria-atomic="true"
                style={{
                  fontSize: 10,
                  color: "var(--canopy-muted)",
                  marginRight: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  className="sync-dot"
                  aria-hidden={true}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: error ? "var(--canopy-red)" : "var(--canopy-green)",
                    boxShadow: error
                      ? "0 0 0 3px rgba(217,79,92,.16)"
                      : "0 0 0 3px rgba(30,155,131,.16)",
                    display: "inline-block",
                  }}
                />
                {syncState}
              </span>
              <Link href="/dashboard/properties" className="btn-secondary">
                <IconBuilding aria-hidden={true} /> 物業
              </Link>
              <Link href="/dashboard/bookings" className="btn-primary">
                <IconPlus aria-hidden={true} /> 新增訂房
              </Link>
            </div>
          </div>

          {/* Mobile scope switcher (≤780px) */}
          <MobileScopeSwitcher
            properties={properties as PropertyOption[]}
            activePropertyId={propertyId}
          />

          {/* Operational pulse (4 categories + headline) */}
          {error ? (
            <div className="ops-error" role="alert">
              <div className="ops-error-copy">
                <strong>{t.page.errorTitle}</strong>
                <span>{error}</span>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => load("initial")}
              >
                <IconRefresh aria-hidden={true} /> {t.page.retry}
              </button>
            </div>
          ) : (
            <OperationalPulse summary={summary} todayDate={todayDate} />
          )}

          {/* KPI strip — 4 cards */}
          <KpiStrip kpi={summary.kpi} loading={loading} />

          {/* Core grid: arrivals/departures timeline + Exception queue */}
          <div className="ops-grid-2">
            <TodayTimeline events={summary.timeline} loading={loading} />
            <Workbench
              items={summary.workbench}
              loading={loading}
              copy={dashboardCopy.queue}
            />
          </div>

          {/* Bottom grid: portfolio health + owner settlements */}
          <div className="ops-grid-2 alt">
            <PropertyPerformance items={summary.propertyPerformance} loading={loading} />
            <OwnerSettlements
              properties={settlementProps}
              totalMtd={totalMtd}
              occupancyBy={occupancies}
            />
          </div>

          {/* Revenue */}
          <RevenueChart series={summary.revenueSeries} loading={loading} />

          {/* Empty state for users with no property yet */}
          {!loading && properties.length === 0 ? (
            <div className="ops-empty" role="status">
              <span
                className="hp-icon-btn"
                style={{
                  pointerEvents: "none",
                  color: "var(--canopy-orange)",
                  background: "var(--canopy-orange-soft)",
                  borderColor: "transparent",
                }}
                aria-hidden={true}
              >
                <IconBuilding />
              </span>
              <h2 className="ops-empty-title">{t.page.emptyTitle}</h2>
              <p className="ops-empty-copy">{t.page.emptyCopy}</p>
              <Link href="/dashboard/properties" className="btn-primary">
                <IconPlus aria-hidden={true} /> {t.page.emptyCta}
              </Link>
            </div>
          ) : null}

          {/* Quick actions row */}
          <div className="actions" aria-label={t.actions.ariaLabel} style={{ marginTop: 18 }}>
            <div>
              <div className="actions-title">{t.actions.title}</div>
              <div className="actions-copy">{t.actions.copy}</div>
            </div>
            <div className="action-buttons">
              <Link href="/dashboard/bookings" className="action primary">
                <IconCalendar aria-hidden={true} /> {t.actions.newBooking}
              </Link>
              <Link href="/dashboard/maintenance" className="action">
                <IconWrench aria-hidden={true} /> {t.actions.addMaintenance}
              </Link>
              <Link href="/dashboard/ics" className="action">
                <IconSync aria-hidden={true} /> {t.actions.icsSync}
              </Link>
              <Link href="/dashboard/reports" className="action">
                <IconList aria-hidden={true} /> {t.actions.exportReport}
              </Link>
            </div>
          </div>

          {/* Footer summary */}
          <footer
            aria-label="dashboard footer"
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 18,
              padding: "12px 16px",
              border: "1px solid var(--canopy-line)",
              borderRadius: 12,
              background: "var(--canopy-panel)",
              color: "var(--canopy-muted)",
              fontSize: 10,
              boxShadow: "var(--canopy-shadow)",
              justifyContent: "space-between",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <IconBell aria-hidden={true} />
              <span>2 件未讀通知</span>
              <a
                href="/dashboard/requirements"
                style={{
                  color: "var(--canopy-violet)",
                  fontWeight: 800,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                立即查看 <IconArrowUpRight aria-hidden={true} />
              </a>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <IconClock aria-hidden={true} />
              <span>Asia/Taipei · UTC+08:00 · {todayDate}</span>
            </span>
          </footer>
        </main>

        <MobileBottomNav />
      </div>
    </div>
  );
}

/* ---- Inline: operational pulse render ---------------------------------- */
function OperationalPulse({
  summary,
  todayDate,
}: {
  summary: DashboardSummary;
  todayDate: string;
}) {
  const t = dashboardCopy.pulse;
  return (
    <div className="alert-strip" role="region" aria-label={t.ariaLabel}>
      <div className="pulse-item">
        <div className="pulse-label" style={{ color: "#aeb8c7" }}>
          <span className="pulse-dot" aria-hidden={true} />
          {t.headline}
        </div>
        <div className="pulse-title">{t.headlineCaption}</div>
        <div className="pulse-copy">{todayDate}</div>
      </div>
      <div className="pulse-item">
        <div className="pulse-label">
          <span className="pulse-dot green" aria-hidden={true} />
          {t.checkIns}
        </div>
        <div
          className="pulse-title"
          style={{ color: "var(--canopy-ink)", font: "850 22px/1 var(--font-mono)" }}
        >
          {summary.kpi.checkInsToday}
        </div>
        <div className="pulse-copy">{t.checkInsHint}</div>
      </div>
      <div className="pulse-item">
        <div className="pulse-label">
          <span className="pulse-dot" aria-hidden={true} />
          {t.checkOuts}
        </div>
        <div
          className="pulse-title"
          style={{ color: "var(--canopy-ink)", font: "850 22px/1 var(--font-mono)" }}
        >
          {summary.kpi.checkOutsToday}
        </div>
        <div className="pulse-copy">{t.checkOutsHint}</div>
      </div>
      <div className="pulse-item">
        <div className="pulse-label">
          <span className="pulse-dot red" aria-hidden={true} />
          {t.cleaning} / {t.maintenance}
        </div>
        <div
          className="pulse-title"
          style={{ color: "var(--canopy-ink)", font: "850 22px/1 var(--font-mono)" }}
        >
          {summary.kpi.openCases}
        </div>
        <div className="pulse-copy">{t.pendingHint}</div>
      </div>
    </div>
  );
}
