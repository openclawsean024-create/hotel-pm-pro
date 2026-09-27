"use client";

// src/components/landing/UseCaseTabs.tsx
// Three personas × three panels. Fully keyboard accessible: tabs use
// roving tabindex + ArrowLeft/ArrowRight, panels are role="tabpanel"
// with id/aria-labelledby. State lives in this client island; the
// page itself stays a server component.
import { useId, useRef, useState } from "react";

type Stat = { value: string; label: string };
type Case = {
  id: string;
  tabLabel: string;
  tabCopy: string;
  panelLabel: string;
  title: string;
  copy: string;
  stats: [Stat, Stat, Stat];
};

const CASES: Case[] = [
  {
    id: "owner",
    tabLabel: "民宿老闆",
    tabCopy: "今天的入住、退房與房況，有沒有漏掉？",
    panelLabel: "OWNER VIEW · 今日營運",
    title: "先把入住體驗顧好，剩下的工作自然有順序。",
    copy: "把今天的入住、退房、待清潔與維修排成一條時間線。你不需要先翻四張表，才知道哪一件事會影響客人。",
    stats: [
      { value: "08", label: "今日入住" },
      { value: "05", label: "今日退房" },
      { value: "07", label: "待處理案件" },
    ],
  },
  {
    id: "manager",
    tabLabel: "包租代管營運",
    tabCopy: "多個物業、房東分潤與維修案件，能不能一起看？",
    panelLabel: "OPERATIONS VIEW · 多物業",
    title: "先找到卡住的物業，再決定人力要放在哪裡。",
    copy: "從全部物業切到單一館別，營運、維修與房東分潤不再各自一套表。把例外留在畫面上，讓團隊少一點追問。",
    stats: [
      { value: "03", label: "管理物業" },
      { value: "12", label: "進行中訂房" },
      { value: "02", label: "高優先維修" },
    ],
  },
  {
    id: "finance",
    tabLabel: "財務與房東",
    tabCopy: "月底報表與拆帳，能不能不用重做一次？",
    panelLabel: "OWNER VIEW · 月報與分帳",
    title: "月底不是重做一次，而是確認一次。",
    copy: "沿用訂房與物業資料整理本月營收、分潤與待匯出報表。讓房東看到清楚的數字，也讓團隊少一輪複製貼上。",
    stats: [
      { value: "$138K", label: "本月營收" },
      { value: "92%", label: "已完成分帳" },
      { value: "02", label: "待匯出報表" },
    ],
  },
];

export default function UseCaseTabs() {
  const [activeIndex, setActiveIndex] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const baseId = useId();

  const moveFocus = (next: number) => {
    setActiveIndex(next);
    const target = tabRefs.current[next];
    if (target) target.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus((index + 1) % CASES.length);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus((index - 1 + CASES.length) % CASES.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveFocus(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveFocus(CASES.length - 1);
    }
  };

  const active = CASES[activeIndex];

  return (
    <div className="landing-use-case">
      {/* Minimal polite live region for tab change announcements. The
          tabpanel itself is intentionally left without aria-live so the full
          panel copy is not re-read on every switch. */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {active.tabLabel}
      </div>
      <div className="landing-tab-list" role="tablist" aria-label="使用情境">
        {CASES.map((item, index) => {
          const selected = index === activeIndex;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              className={`landing-tab${selected ? " active" : ""}`}
              onClick={() => setActiveIndex(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className="landing-tab-title">
                <span>{item.tabLabel}</span>
                <span aria-hidden="true">→</span>
              </span>
              <span className="landing-tab-copy">{item.tabCopy}</span>
            </button>
          );
        })}
      </div>
      <div
        className="landing-case-panel"
        role="tabpanel"
        id={`${baseId}-panel-${active.id}`}
        aria-labelledby={`${baseId}-tab-${active.id}`}
        tabIndex={0}
      >
        <div className="landing-case-panel-top">
          <span className="landing-case-panel-label">{active.panelLabel}</span>
          <span className="landing-case-panel-badge">Demo data only</span>
        </div>
        <h3>{active.title}</h3>
        <p>{active.copy}</p>
        <div className="landing-case-stats">
          {active.stats.map((stat) => (
            <div key={stat.label} className="landing-case-stat">
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
