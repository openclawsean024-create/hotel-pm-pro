// components/dashboard/TodayTimeline.tsx — today's events in time order
"use client";

import type { TimelineItem } from "./types";

const TYPE_LABEL: Record<TimelineItem["type"], string> = {
  checkin: "入住",
  checkout: "退房",
  cleaning: "待清潔",
  maintenance: "維修",
};

export function TodayTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">今日營運</h3>
          <p className="card-subtitle">入住 / 退房 / 清潔 / 維修</p>
        </div>
        <span className="scope-text">{items.length} 件</span>
      </div>
      <div className="card-body">
        {items.length === 0 ? (
          <p className="muted">今日沒有安排事項。</p>
        ) : (
          <ol className="timeline" aria-label="今日事件時序">
            {items.map((item, idx) => (
              <li className="timeline-item" key={`${item.time}-${idx}-${item.propertyId}-${item.type}`}>
                <span className="timeline-time tabular-nums">{item.time}</span>
                <span className={`timeline-dot tone-${item.pill.tone}`} aria-hidden="true" />
                <div>
                  <div className="timeline-title">
                    {TYPE_LABEL[item.type]}
                    <span className={`timeline-pill tone-${item.pill.tone}`}>
                      {item.pill.label}
                    </span>
                  </div>
                  <div className="timeline-meta">{item.meta}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
