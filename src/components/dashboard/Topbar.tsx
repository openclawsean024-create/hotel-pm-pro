// components/dashboard/Topbar.tsx
// Header strip on /dashboard — drops the legacy personal bar in favor of the
// international SaaS pattern: breadcrumb · scope · search · locale/TZ ·
// notification · avatar. Tier + sign-out moved to a hover sheet to keep the
// topbar single-line and mobile-friendly.
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import {
  IconBell,
  IconCommand,
  IconRefresh,
} from "./icons";
import { dashboardCopy } from "./i18n";

type UserLike = { email?: string | null; name?: string | null };

function todayInTaipei(): string {
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

function greetingFor(date: Date, copy: typeof dashboardCopy.topbar): string {
  const h = date.getHours();
  if (h < 11) return copy.greetingMorning;
  if (h < 17) return copy.greetingAfternoon;
  return copy.greetingEvening;
}

function initialsOf(user: UserLike): string {
  const raw = (user?.name ?? user?.email ?? "").trim();
  if (!raw) return "PM";
  const parts = raw.split(/[\s@.]/u).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return raw.slice(0, 2).toUpperCase();
}

export function Topbar({
  user,
  tier,
  activePropertyName,
  onRefresh,
  refreshing,
  pageTitle,
}: {
  user: UserLike | null;
  tier: string;
  activePropertyName: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  pageTitle: string;
}) {
  const t = dashboardCopy;
  const [now, setNow] = useState<string>(() => todayInTaipei());
  const [greeting, setGreeting] = useState<string>(() =>
    greetingFor(new Date(), t.topbar),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setNow(todayInTaipei());
      setGreeting(greetingFor(new Date(), t.topbar));
    }, 60_000);
    return () => clearInterval(id);
  }, [t.topbar]);

  const initials = useMemo(() => initialsOf(user ?? {}), [user]);

  return (
    <header
      className="ops-topbar"
      role="banner"
      aria-label="頁面頂部"
    >
      <div className="hp-topbar">
        {/* Left: breadcrumb + scope pill */}
        <div className="hp-topbar-left">
          <div className="hp-crumbs" aria-label={t.topbar.breadcrumbs}>
            <span aria-hidden="true">/</span>
            <span aria-hidden="true">Dashboard</span>
            <span className="hp-crumbs-sep" aria-hidden="true">·</span>
            <span>{t.topbar.breadcrumbOverview}</span>
            <strong>· {pageTitle}</strong>
          </div>
          {activePropertyName && (
            <span
              className="ops-scope-chip"
              title={activePropertyName}
              aria-label={`目前管理範圍：${activePropertyName}`}
            >
              <IconCommand aria-hidden={true} />
              {activePropertyName}
            </span>
          )}
        </div>

        {/* Right: search · locale · notification · refresh · avatar */}
        <div className="hp-topbar-right">
          <label className="hp-search" aria-label={t.topbar.searchAria}>
            <IconCommand aria-hidden={true} />
            <input
              type="search"
              name="dashboard-search"
              placeholder={t.topbar.searchPlaceholder}
              autoComplete="off"
              spellCheck={false}
            />
            <span className="key" aria-hidden="true">⌘ K</span>
          </label>

          <button
            type="button"
            className="hp-locale-pill"
            aria-label={`${t.topbar.localeAria} · ${t.topbar.tzHint}`}
            title={`${t.topbar.localeLabel} · ${t.topbar.tzHint}`}
          >
            <span aria-hidden="true">🌐</span>
            <span>zh-Hant · NT$</span>
            <span style={{ color: "var(--canopy-muted)" }}>· {t.topbar.tzHint}</span>
          </button>

          <span
            className="hp-topbar-greeting"
            aria-label={`${greeting}，今天是 ${now}`}
          >
            <span className="hello">
              {greeting}，{user?.name ?? user?.email ?? "operator"}
            </span>
            <span className="when">{now}</span>
          </span>

          {onRefresh && (
            <button
              type="button"
              className="hp-icon-btn"
              onClick={onRefresh}
              aria-label={t.page.refreshAria}
              title={t.page.refresh}
              disabled={refreshing}
            >
              <IconRefresh aria-hidden={true} />
              <span className="sr-only">{t.page.refresh}</span>
            </button>
          )}

          <button
            type="button"
            className="hp-icon-btn"
            aria-label={`${t.topbar.notifyAria}，2 件未讀`}
            title={t.topbar.notifyAria}
          >
            <IconBell aria-hidden={true} />
            <span className="ping" aria-hidden="true" />
            <span className="sr-only">{t.topbar.notifyAria}</span>
          </button>

          <span
            className="tier-pill"
            aria-label={`方案：${tier}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "0 9px",
              height: 32,
              border: "1px solid var(--canopy-line)",
              borderRadius: 8,
              background: "var(--canopy-panel)",
              color: tier === "free" ? "var(--canopy-orange)" : "var(--canopy-ink-2)",
              fontWeight: 800,
              fontSize: 11,
            }}
          >
            <span style={{ textTransform: "uppercase" }}>{tier}</span>
            {tier === "free" && (
              <Link
                href="/pricing"
                style={{ color: "var(--canopy-orange)", textDecoration: "none" }}
              >
                {t.topbar.upgrade}
              </Link>
            )}
          </span>

          <button
            type="button"
            className="hp-avatar"
            aria-label={`account: ${user?.email ?? "—"}`}
            title={user?.email ?? "—"}
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <span aria-hidden="true">{initials}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
