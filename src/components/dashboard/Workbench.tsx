// components/dashboard/Workbench.tsx — Exception queue (open cases sorted by priority)
"use client";

import Link from "next/link";
import { IconList, IconAlertNew } from "./icons";
import type { WorkbenchItem } from "./types";

type Props = {
  items: WorkbenchItem[];
  loading?: boolean;
  copy: {
    title: string;
    subtitle: string;
    filterAll: string;
    filterOpen: string;
    filterProgress: string;
    filterDone: string;
    deadlineUrgent: string;
    empty: string;
    rowCountSingular: string;
    rowCountPlural: string;
    seeAllRequirements: string;
    seeAllMaintenance: string;
    priorityLow: string;
    priorityNormal: string;
    priorityHigh: string;
    priorityUrgent: string;
    statusOpen: string;
    statusInProgress: string;
    statusPending: string;
    statusResolved: string;
    statusClosed: string;
    statusCompleted: string;
    statusCancelled: string;
  };
};

const PRIORITY_LABEL: Record<WorkbenchItem["priority"], string> = {
  low: "低",
  normal: "中",
  high: "高",
  urgent: "急",
};

const PRIORITY_TONE: Record<WorkbenchItem["priority"], string> = {
  low: "muted",
  normal: "yellow",
  high: "red",
  urgent: "red",
};

function statusToBucket(s: string): "open" | "progress" | "done" {
  const t = s.toLowerCase();
  if (["open", "pending"].includes(t)) return "open";
  if (["in_progress", "in-progress", "progress", "scheduled"].includes(t)) return "progress";
  if (["done", "resolved", "completed", "closed", "cancelled", "canceled"].includes(t))
    return "done";
  return "open";
}

function statusToLabel(s: string, copy: Props["copy"]): string {
  if (!copy) return s;
  const map: Record<string, string> = {
    open: copy.statusOpen,
    pending: copy.statusPending,
    in_progress: copy.statusInProgress,
    "in-progress": copy.statusInProgress,
    progress: copy.statusInProgress,
    scheduled: copy.statusPending,
    resolved: copy.statusResolved,
    completed: copy.statusCompleted,
    closed: copy.statusClosed,
    cancelled: copy.statusCancelled,
    canceled: copy.statusCancelled,
    done: copy.statusCompleted,
  };
  return map[s.toLowerCase()] ?? s;
}

function statusToIconBucket(s: string): "open" | "progress" | "done" {
  return statusToBucket(s);
}

export function Workbench({ items, loading, copy: copyProp }: Props) {
  // Non-null fallback so consumer callers don't have to thread every label.
  const copy: NonNullable<Props["copy"]> = copyProp ?? {
    title: "",
    subtitle: "需求單 + 派工單，依優先級排序",
    filterAll: "All",
    filterOpen: "Open",
    filterProgress: "In progress",
    filterDone: "Done",
    deadlineUrgent: "已逾期",
    empty: "目前沒有待處理案件。",
    rowCountSingular: `${items.length} items`,
    rowCountPlural: `${items.length} items`,
    seeAllRequirements: "查看全部需求單",
    seeAllMaintenance: "查看全部派工單",
    priorityLow: "低",
    priorityNormal: "中",
    priorityHigh: "高",
    priorityUrgent: "急",
    statusOpen: "待處理",
    statusInProgress: "進行中",
    statusPending: "待處理",
    statusResolved: "已完成",
    statusClosed: "已關閉",
    statusCompleted: "已完成",
    statusCancelled: "已取消",
  };

  const sorted = items.slice().sort((a, b) => {
    const order: Record<WorkbenchItem["priority"], number> = {
      urgent: 0, high: 1, normal: 2, low: 3,
    };
    return order[a.priority] - order[b.priority];
  });
  const top = sorted.slice(0, 5);

  return (
    <section className="card workbench" aria-labelledby="wb-title">
      <header className="card-header">
        <div>
          <h2 id="wb-title" className="card-title">
            待辦工作台 · Open work items
          </h2>
          <p className="card-subtitle">
            {copy.subtitle ?? "需求單 + 派工單，依優先級排序"}
          </p>
        </div>
        <span className="link" aria-hidden={true}>priority sort</span>
      </header>

      <div className="queue-tools" role="tablist" aria-label="Filter">
        <button type="button" className="queue-filter active" role="tab" aria-selected="true">
          {copy.filterAll ?? "All"} ({items.length})
        </button>
        <button type="button" className="queue-filter" role="tab" aria-selected="false">
          {copy.filterOpen ?? "Open"}
        </button>
        <button type="button" className="queue-filter" role="tab" aria-selected="false">
          {copy.filterProgress ?? "In progress"}
        </button>
        <button type="button" className="queue-filter" role="tab" aria-selected="false">
          {copy.filterDone ?? "Done"}
        </button>
        <span className="owner-filter">
          {copy.rowCountPlural ?? `${items.length} items`}
        </span>
      </div>

      <div className="queue" role="list">
        {loading ? (
          <div className="ops-skeleton" aria-hidden={true}>
            <div className="skeleton-strip" />
            <div className="skeleton-strip" />
            <div className="skeleton-strip" />
            <div className="skeleton-strip" />
          </div>
        ) : top.length === 0 ? (
          <p
            className="muted"
            style={{ padding: "16px 17px 20px", margin: 0 }}
            role="listitem"
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <IconList aria-hidden={true} /> {copy.empty ?? "目前沒有待處理案件。"}
            </span>
          </p>
        ) : (
          top.map((item) => {
            const bucket = statusToIconBucket(item.status);
            const isUrgent =
              item.priority === "urgent" ||
              (item.dueAt && new Date(item.dueAt).getTime() < Date.now());
            return (
              <div className="queue-item" key={item.id} role="listitem">
                <span className={`queue-status ${bucket}`} aria-hidden={true}>
                  {item.priority === "urgent" || item.priority === "high" ? (
                    <IconAlertNew aria-hidden={true} />
                  ) : (
                    <IconList aria-hidden={true} />
                  )}
                </span>
                <Link
                  href={
                    item.kind === "requirement"
                      ? "/dashboard/requirements"
                      : "/dashboard/maintenance"
                  }
                  className="task-title"
                >
                  <div className="queue-title">{item.title}</div>
                  <div className="queue-meta">
                    {item.kindLabel} · 物業 {item.propertyId.slice(0, 6)} ·{" "}
                    <span className={`priority ${PRIORITY_TONE[item.priority]}`}>
                      {PRIORITY_LABEL[item.priority]}
                    </span>{" "}
                    · {statusToLabel(item.status, copy)}
                  </div>
                </Link>
                {item.dueAt && (
                  <span className={`deadline ${isUrgent ? "urgent" : ""}`}>
                    {item.dueAt}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="queue-foot">
        <span className="workbench-links">
          <Link href="/dashboard/requirements" className="link">
            {copy.seeAllRequirements ?? "查看全部需求單"} →
          </Link>
          <Link href="/dashboard/maintenance" className="link">
            {copy.seeAllMaintenance ?? "查看全部派工單"} →
          </Link>
        </span>
        <span className="muted">Showing {top.length} of {items.length}</span>
      </div>
    </section>
  );
}
