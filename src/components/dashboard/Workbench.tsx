// components/dashboard/Workbench.tsx — top 5 open items, combined table
"use client";

import Link from "next/link";
import type { WorkbenchItem } from "./types";

const PRIORITY_LABEL: Record<WorkbenchItem["priority"], string> = {
  urgent: "急",
  high: "高",
  normal: "中",
  low: "低",
};

const STATUS_LABEL: Record<string, string> = {
  open: "待處理",
  in_progress: "進行中",
  pending: "待處理",
  resolved: "已完成",
  closed: "已關閉",
  completed: "已完成",
  cancelled: "已取消",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export function Workbench({
  items,
  propertyNameById,
}: {
  items: WorkbenchItem[];
  propertyNameById: Record<string, string>;
}) {
  return (
    <div className="card workbench">
      <div className="card-header">
        <div>
          <h3 className="card-title">待辦工作台</h3>
          <p className="card-subtitle">需求單 + 派工單，依優先級排序</p>
        </div>
        <div className="workbench-links">
          <Link href="/dashboard/requirements" className="btn-quiet">
            查看全部需求單
          </Link>
          <Link href="/dashboard/maintenance" className="btn-quiet">
            查看全部派工單
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card-body">
          <p className="muted">目前沒有待處理案件。</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">案件</th>
                <th scope="col">物業</th>
                <th scope="col">類型</th>
                <th scope="col">優先級</th>
                <th scope="col">截止時間</th>
                <th scope="col">狀態</th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => {
                const href =
                  w.kind === "requirement"
                    ? "/dashboard/requirements"
                    : "/dashboard/maintenance";
                return (
                  <tr key={`${w.kind}-${w.id}`}>
                    <td>
                      <Link href={href} className="task-title">
                        {w.title}
                      </Link>
                    </td>
                    <td className="muted">
                      {propertyNameById[w.propertyId] ?? "—"}
                    </td>
                    <td>{w.kindLabel}</td>
                    <td>
                      <span className={`priority ${w.priority}`}>
                        {PRIORITY_LABEL[w.priority]}
                      </span>
                    </td>
                    <td className="tabular-nums muted">
                      {formatDate(w.dueAt)}
                    </td>
                    <td>
                      <span
                        className={`status ${
                          w.status === "open" || w.status === "pending"
                            ? "todo"
                            : w.status === "in_progress"
                              ? "progress"
                              : "done"
                        }`}
                      >
                        {STATUS_LABEL[w.status] ?? w.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="table-footer">
        <span className="muted">共 {items.length} 件 · 顯示前 5 件</span>
      </div>
    </div>
  );
}
