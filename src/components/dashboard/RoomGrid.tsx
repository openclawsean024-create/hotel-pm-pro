// components/dashboard/RoomGrid.tsx — Room status grid + occupancy summary
"use client";

import type { Room, RoomState } from "./types";
import { IconBed, IconWrench } from "./icons";

const STATE_META: Record<
  RoomState,
  { label: string; tone: "ready" | "info" | "pending" | "blocked" | "empty" }
> = {
  empty: { label: "空房", tone: "empty" },
  occupied: { label: "已入住", tone: "info" },
  checkout_today: { label: "今日退房", tone: "info" },
  cleaning: { label: "待清潔", tone: "pending" },
  maintenance: { label: "維修中", tone: "blocked" },
};

export function RoomGrid({
  rooms,
  occupancy,
}: {
  rooms: Room[];
  occupancy: {
    rate: number;
    available: number;
    occupied: number;
    cleaning: number;
    maintenance: number;
  };
}) {
  if (rooms.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">房況總覽</h3>
          <p className="card-subtitle">目前沒有物業</p>
        </div>
        <div className="card-body empty-card-body">
          <p className="muted">新增第一個物業即可開始管理房況。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card room-card">
      <div className="card-header">
        <div>
          <h3 className="card-title">房況總覽</h3>
          <p className="card-subtitle">以物業作為視覺代理（無 Room model）</p>
        </div>
        <span className="scope-text">{rooms.length} 間</span>
      </div>
      <div className="card-body">
        <div className="occupancy-summary" aria-label="入住率摘要">
          <div>
            <div className="occupancy-rate tabular-nums">{occupancy.rate}%</div>
            <div className="occupancy-label">入住率</div>
          </div>
          <div className="mini-stat">
            <strong className="tabular-nums">{occupancy.occupied}</strong>
            <span>已入住</span>
          </div>
          <div className="mini-stat">
            <strong className="tabular-nums">{occupancy.cleaning}</strong>
            <span>待清潔</span>
          </div>
          <div className="mini-stat">
            <strong className="tabular-nums">{occupancy.maintenance}</strong>
            <span>維修中</span>
          </div>
        </div>

        <div className="room-grid" role="list">
          {rooms.map((r) => {
            const meta = STATE_META[r.state];
            return (
              <div
                key={r.id}
                role="listitem"
                className={`room state-${r.state} tone-${meta.tone}`}
              >
                <span className="room-id">{r.name}</span>
                <span className="room-type">{r.roomType}</span>
                <span className="room-state">
                  <span className="room-state-icon" aria-hidden="true">
                    {r.state === "maintenance" ? <IconWrench width={12} height={12} /> : <IconBed width={12} height={12} />}
                  </span>
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
