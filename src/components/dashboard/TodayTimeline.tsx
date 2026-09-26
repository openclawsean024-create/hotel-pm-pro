// components/dashboard/TodayTimeline.tsx — Today's arrivals/departures/cleaning/maintenance
"use client";

import type { TimelineItem } from "./types";

type Props = {
  events: TimelineItem[];
  loading?: boolean;
};

const TYPE_LABEL: Record<TimelineItem["type"], string> = {
  checkin: "Check-in",
  checkout: "Check-out",
  cleaning: "Cleaning",
  maintenance: "Maintenance",
};

const PILL_TONE: Record<string, string> = {
  checkin: "ready",
  checkout: "info",
  cleaning: "pending",
  maintenance: "blocked",
};

const DOT_TONE: Record<string, string> = {
  checkin: "green",
  checkout: "blue",
  cleaning: "yellow",
  maintenance: "red",
};

export function TodayTimeline({ events, loading }: Props) {
  return (
    <section className="card today-card" aria-labelledby="today-title">
      <header className="card-header">
        <div>
          <h2 id="today-title" className="card-title">
            今日營運 · Today's operations
          </h2>
          <p className="card-subtitle">入住 / 退房 / 清潔 / 維修</p>
        </div>
        <span className="link" aria-hidden="true">{events.length} 項</span>
      </header>
      <div className="card-body" style={{ minHeight: 220 }}>
        {loading ? (
          <div className="ops-skeleton" aria-hidden={true}>
            <div className="skeleton-strip" />
            <div className="skeleton-strip" />
            <div className="skeleton-strip" />
            <div className="skeleton-strip" />
          </div>
        ) : events.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            今日沒有安排事項。
          </p>
        ) : (
          <ul className="timeline" role="list">
            {events.map((item, i) => (
              <li className="timeline-item" key={`${item.time}-${i}`}>
                <time className="timeline-time">{item.time}</time>
                <span
                  className={`timeline-dot ${DOT_TONE[item.type] ? `tone-${DOT_TONE[item.type]}` : ""}`}
                  aria-hidden={true}
                />
                <div className="timeline-body">
                  <div className="timeline-title">
                    <span>{TYPE_LABEL[item.type]}</span>
                    <span style={{ color: "var(--canopy-muted)", fontWeight: 500 }}>
                      {item.meta}
                    </span>
                  </div>
                  <div className="timeline-meta">{item.propertyId}</div>
                </div>
                <span
                  className={`timeline-pill ${PILL_TONE[item.type] ? `tone-${PILL_TONE[item.type]}` : ""}`}
                >
                  {item.pill.label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
