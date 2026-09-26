// app/page.tsx — Hotel PM Pro public landing page
// Adopts the approved `landing-redesign.html` visual prototype (navy ink
// + teal + warm off-white canvas) while routing every CTA to a real
// public route — no prototype alerts, no fake form posts, no demo API.
// Server component: interactive bits (mobile menu, use-case tabs) are
// isolated in their own client components.
import Link from "next/link";

import MobileNav from "@/components/landing/MobileNav";
import UseCaseTabs from "@/components/landing/UseCaseTabs";
import { ArrowIcon, HouseIcon } from "@/components/landing/icons";

export const metadata = {
  title: "民宿管家 hotel-pm — 每天先看該處理什麼",
  description:
    "把物業、房客、訂房、維修與房東分帳放進同一個營運畫面。台灣民宿與包租代管業者的繁中物業管理系統，月費 NT$499 起。",
};

const navLinks = [
  { href: "#workflow", label: "怎麼工作" },
  { href: "#features", label: "功能" },
  { href: "#compare", label: "為什麼是我們" },
  { href: "#pricing", label: "方案" },
];

const mobileNavLinks = [
  ...navLinks,
  { href: "/login", label: "登入系統" },
  { href: "/pricing", label: "看示範" },
];

const features = [
  {
    icon: "⌂",
    title: "物業與房客脈絡",
    copy: "地址、房型、租約、房客與押金集中管理，換班時不用重新問一輪。",
  },
  {
    icon: "▣",
    title: "訂房與 ICS 匯入",
    copy: "手動訂房與外部行事曆放進同一個看板，清楚知道哪間房何時被占用。",
  },
  {
    icon: "⌁",
    title: "維修與需求派工",
    copy: "把房客反應轉成有優先級、有負責人、有完成狀態的案件。",
  },
  {
    icon: "↗",
    title: "月報與房東分帳",
    copy: "用同一份資料整理營收、訂房數與分潤，報表可以直接交付。",
  },
  {
    icon: "◷",
    title: "多物業總覽",
    copy: "切換單一物業或全部物業，先看例外與阻塞，不必逐館巡查。",
  },
  {
    icon: "✦",
    title: "繁中、低負擔",
    copy: "不需要先學一套飯店術語；用台灣團隊日常說話的方式完成工作。",
  },
];

const workflows = [
  {
    title: "先看今天的房況",
    copy: "入住、退房、待清潔與維修，在同一個營運總覽先排優先順序。",
  },
  {
    title: "把訂房集中起來",
    copy: "手動新增訂房，或用 Airbnb／Booking.com ICS 匯入並避免重複。",
  },
  {
    title: "把問題交給對的人",
    copy: "需求單、優先級、廠商與處理狀態，不再散落在聊天記錄裡。",
  },
  {
    title: "月底直接做分帳",
    copy: "用月報整理營收與房東分潤，少一次人工重算與複製貼上。",
  },
];

const plans = [
  {
    name: "FREE",
    price: "NT$0",
    desc: "適合先整理一個小型物業的基本資料。",
    features: ["5 房以內", "物業與房客管理", "月報表 PDF"],
    cta: "開始使用",
    href: "/login",
    featured: false,
  },
  {
    name: "PRO",
    price: "NT$499",
    desc: "把訂房、ICS 與房東分帳接進每日營運。",
    features: ["20 房以內", "ICS 自動匯入", "拆帳自動計算", "Email 客服"],
    cta: "開始使用 Pro",
    href: "/checkout?plan=pro",
    featured: true,
    badge: "最適合小型團隊",
  },
  {
    name: "BUSINESS",
    price: "NT$1,499",
    desc: "給需要多人協作與更大房源規模的營運團隊。",
    features: ["無限房", "團隊帳號", "優先客服", "API 串接"],
    cta: "詢問 Business",
    href: "/contact",
    featured: false,
  },
];

const compareRows = [
  {
    label: "小型民宿上手速度",
    cells: [
      { kind: "note", text: "功能完整，導入較重" },
      { kind: "note", text: "偏向短租規模化" },
      { kind: "note", text: "偏租賃與收租" },
      { kind: "yes", text: "繁中、從今天開始用" },
    ],
  },
  {
    label: "房東分潤與月報",
    cells: [
      { kind: "note", text: "可做，但常需設定" },
      { kind: "note", text: "偏 owner reporting" },
      { kind: "note", text: "租金帳務較強" },
      { kind: "yes", text: "旅宿營收＋分潤一起看" },
    ],
  },
  {
    label: "訂房與房務脈絡",
    cells: [
      { kind: "yes", text: "完整" },
      { kind: "yes", text: "完整" },
      { kind: "note", text: "不是核心" },
      { kind: "yes", text: "保留必要的訂房／ICS／待辦" },
    ],
  },
  {
    label: "導入成本與產品密度",
    cells: [
      { kind: "note", text: "企業級方案" },
      { kind: "note", text: "規模化方案" },
      { kind: "note", text: "流程彈性高" },
      { kind: "yes", text: "NT$499 起，聚焦 5–20 房" },
    ],
  },
] as const;

const proofChips = [
  { num: "01", label: "物業與房客" },
  { num: "02", label: "訂房與 ICS" },
  { num: "03", label: "維修與待辦" },
  { num: "04", label: "月報與分帳" },
];

export default function Home() {
  return (
    <div className="landing">
      {/* Skip-to-content link for keyboard users (WCAG 2.4.1) */}
      <a href="#top" className="landing-skip-link">
        跳至主要內容
      </a>

      {/* Topline */}
      <div className="landing-topline" role="region" aria-label="產品定位">
        <div className="landing-wrap landing-topline-inner">
          <span className="landing-topline-dot" aria-hidden="true" />
          <span>
            <strong>為台灣小型民宿與包租代管設計</strong>
            <span className="landing-preview-tag"> · 先把今天的事處理好，再看下一間房</span>
          </span>
        </div>
      </div>

      {/* Header / nav */}
      <header className="landing-nav">
        <div className="landing-wrap landing-nav-inner">
          <Link href="#top" className="landing-brand" aria-label="回到首頁">
            <span className="landing-brand-mark">
              <HouseIcon />
            </span>
            <span className="landing-brand-text">
              <span className="landing-brand-name">民宿管家</span>
              <span className="landing-brand-sub">PROPERTY OPERATIONS</span>
            </span>
          </Link>
          <nav className="landing-nav-links" aria-label="主要導覽">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
          <div className="landing-nav-actions">
            <Link href="/login" className="landing-btn-quiet landing-nav-link-text">
              登入
            </Link>
            <Link href="/pricing" className="landing-btn landing-btn-primary">
              看示範 <ArrowIcon width={16} height={16} />
            </Link>
            <MobileNav links={mobileNavLinks} />
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="landing-hero" aria-labelledby="landing-hero-heading">
          <div className="landing-wrap landing-hero-grid">
            <div>
              <div className="landing-eyebrow">給每天都在處理入住、退房與報修的人</div>
              <h1 id="landing-hero-heading">
                每天先看
                <br />
                <em>該處理什麼</em>，
                <br />
                再看賺了多少。
              </h1>
              <p className="landing-hero-copy">
                民宿管家把物業、房客、訂房、維修與房東分帳放進同一個營運畫面。
                <strong>少一點 Excel 與 LINE 來回，多一點真正可掌握的營運。</strong>
              </p>
              <div className="landing-hero-actions">
                <a href="#workflow" className="landing-btn landing-btn-primary">
                  看看怎麼工作 <ArrowIcon width={16} height={16} />
                </a>
                <Link href="/login" className="landing-btn">
                  登入系統
                </Link>
              </div>
              <div className="landing-hero-note" aria-label="產品特色快速一覽">
                <span>
                  <b>✓</b> 繁中流程
                </span>
                <span>
                  <b>✓</b> 房東分帳
                </span>
                <span>
                  <b>✓</b> ICS 同步
                </span>
                <span>
                  <b>✓</b> NT$499 起
                </span>
              </div>
            </div>

            {/* Product preview (visual demo only — labels clearly mark "示範") */}
            <div
              className="landing-product-preview"
              role="img"
              aria-label="民宿管家營運總覽的視覺示範，內容為示意資料"
            >
              <div className="landing-preview-window">
                <div className="landing-preview-bar">
                  <div className="landing-preview-brand">
                    <span className="landing-preview-brand-mark">家</span>
                    民宿管家 <span className="landing-preview-tag">/ 總覽</span>
                  </div>
                  <div className="landing-preview-tools">
                    <span>2026 / 09 / 24</span>
                    <span className="landing-preview-user" aria-hidden="true">
                      林
                    </span>
                  </div>
                </div>
                <div className="landing-preview-body">
                  <aside className="landing-preview-side" aria-hidden="true">
                    <div className="landing-side-label">營運</div>
                    <div className="landing-side-item active">
                      <span className="landing-side-icon">▦</span>
                      總覽
                    </div>
                    <div className="landing-side-item">
                      <span className="landing-side-icon">⌂</span>
                      房況總覽
                    </div>
                    <div className="landing-side-label" style={{ marginTop: 18 }}>
                      管理
                    </div>
                    <div className="landing-side-item">
                      <span className="landing-side-icon">▣</span>
                      訂房管理
                    </div>
                    <div className="landing-side-item">
                      <span className="landing-side-icon">♙</span>
                      房客 CRM
                    </div>
                    <div className="landing-side-item">
                      <span className="landing-side-icon">⌁</span>
                      維修與待辦
                    </div>
                    <div className="landing-side-label" style={{ marginTop: 18 }}>
                      財務
                    </div>
                    <div className="landing-side-item">
                      <span className="landing-side-icon">↗</span>
                      月報與分帳
                    </div>
                  </aside>
                  <div className="landing-preview-main">
                    <div className="landing-preview-heading">
                      <div>
                        <div className="landing-preview-kicker">
                          THURSDAY · 09.24.2026
                        </div>
                        <div className="landing-preview-title">
                          早安，怡君。今天有 7 件事
                        </div>
                      </div>
                      <div className="landing-preview-date">全部物業⌄</div>
                    </div>
                    <div className="landing-preview-alert" role="status">
                      <span aria-hidden="true">⚠</span>
                      <span>
                        <strong>先處理：</strong>
                        208 房待清潔，1 筆訂房待確認
                      </span>
                    </div>
                    <div className="landing-preview-metrics">
                      <div className="landing-preview-metric">
                        <div className="landing-preview-metric-label">今日入住</div>
                        <div className="landing-preview-metric-value">08</div>
                        <div className="landing-preview-metric-foot">↑ 2 間</div>
                      </div>
                      <div className="landing-preview-metric">
                        <div className="landing-preview-metric-label">今日退房</div>
                        <div className="landing-preview-metric-value">05</div>
                        <div
                          className="landing-preview-metric-foot foot-blue"
                        >
                          最晚 12:00
                        </div>
                      </div>
                      <div className="landing-preview-metric">
                        <div className="landing-preview-metric-label">本月營收</div>
                        <div className="landing-preview-metric-value">284K</div>
                        <div className="landing-preview-metric-foot">↑ 8.4%</div>
                      </div>
                      <div className="landing-preview-metric">
                        <div className="landing-preview-metric-label">待處理</div>
                        <div className="landing-preview-metric-value">07</div>
                        <div
                          className="landing-preview-metric-foot foot-coral"
                        >
                          2 高優先
                        </div>
                      </div>
                    </div>
                    <div className="landing-preview-columns">
                      <div className="landing-preview-card">
                        <div className="landing-preview-card-head">
                          今日營運 <small>完整行程 →</small>
                        </div>
                        <div className="landing-event">
                          <div className="landing-event-time">09:00</div>
                          <div className="landing-event-dot" />
                          <div>
                            <div className="landing-event-title">
                              退房檢查 · 102 房
                            </div>
                            <div className="landing-event-meta">
                              王小姐 · 中山館
                            </div>
                          </div>
                        </div>
                        <div className="landing-event">
                          <div className="landing-event-time">10:30</div>
                          <div className="landing-event-dot amber" />
                          <div>
                            <div className="landing-event-title">
                              清潔排程 · 202、208 房
                            </div>
                            <div className="landing-event-meta">
                              阿宏清潔 · 待派工
                            </div>
                          </div>
                        </div>
                        <div className="landing-event">
                          <div className="landing-event-time">16:30</div>
                          <div className="landing-event-dot coral" />
                          <div>
                            <div className="landing-event-title">
                              維修到場 · 208 房
                            </div>
                            <div className="landing-event-meta">
                              冷氣異音 · 高優先
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="landing-preview-card">
                        <div className="landing-preview-card-head">
                          房東分帳 <small>本月</small>
                        </div>
                        <div className="landing-owner-row">
                          <div>
                            <div className="landing-owner-name">中山館</div>
                            <div className="landing-owner-meta">林屋主 · 12 房</div>
                          </div>
                          <div className="landing-owner-value">$82,400</div>
                        </div>
                        <div className="landing-owner-row">
                          <div>
                            <div className="landing-owner-name">逢甲館</div>
                            <div className="landing-owner-meta">陳屋主 · 8 房</div>
                          </div>
                          <div className="landing-owner-value">$56,180</div>
                        </div>
                        <div className="landing-owner-row">
                          <div>
                            <div className="landing-owner-name">待匯出報表</div>
                            <div className="landing-owner-meta">2 份</div>
                          </div>
                          <div className="landing-owner-value">→</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="landing-preview-caption">
                <span className="landing-caption-check" aria-hidden="true">
                  ✓
                </span>
                今天的工作，已經排好順序
              </div>
            </div>
          </div>
        </section>

        {/* Proof strip */}
        <section className="landing-proof" aria-label="涵蓋的工作流">
          <div className="landing-wrap landing-proof-inner">
            <span className="landing-proof-label">
              一套系統，串起每天真正會發生的事
            </span>
            <div className="landing-proof-list">
              {proofChips.map((chip) => (
                <span key={chip.num} className="landing-proof-chip">
                  <b>{chip.num}</b>
                  {chip.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Use cases — accessible client tabs */}
        <section className="landing-section" id="use-cases" aria-labelledby="use-cases-heading">
          <div className="landing-wrap">
            <div className="landing-section-head">
              <div className="landing-section-kicker">A CLEARER DAY</div>
              <h2 id="use-cases-heading">
                不同角色，看見同一套
                <br />
                不一樣的重點。
              </h2>
              <p className="landing-section-lead">
                不把所有功能塞在第一屏。先選你的工作情境，系統把最有用的數字與下一步放到前面。
              </p>
            </div>
            <UseCaseTabs />
          </div>
        </section>

        {/* Workflow */}
        <section className="landing-section alt" id="workflow" aria-labelledby="workflow-heading">
          <div className="landing-wrap">
            <div className="landing-section-head center">
              <div className="landing-section-kicker">FROM CHAOS TO CONTROL</div>
              <h2 id="workflow-heading">
                把每天的忙，變成
                <br />
                看得懂的四個步驟。
              </h2>
              <p className="landing-section-lead">
                產品不追求「什麼都有」，只把小型旅宿最常重複的工作接起來。
              </p>
            </div>
            <div className="landing-workflow-grid">
              {workflows.map((step, index) => (
                <article key={step.title} className="landing-workflow-card">
                  <div className="landing-workflow-number">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Compare */}
        <section className="landing-section" id="compare" aria-labelledby="compare-heading">
          <div className="landing-wrap">
            <div className="landing-compare">
              <div className="landing-compare-head">
                <div className="landing-section-kicker">POSITIONING</div>
                <h2 id="compare-heading">我們不和大型 PMS 比功能數量。</h2>
                <p>
                  大型平台強在全球分銷與擴張；台灣租賃工具強在租務自動化。民宿管家把位置放在兩者之間：用小型團隊負擔得起的方式，處理旅宿每天最關鍵的營運。
                </p>
              </div>
              <div role="region" aria-label="產品定位比較" tabIndex={0}>
                <table className="landing-compare-table">
                  <thead>
                    <tr>
                      <th scope="col">你真正需要的</th>
                      <th scope="col">大型飯店 PMS</th>
                      <th scope="col">全球短租平台</th>
                      <th scope="col">台灣租賃工具</th>
                      <th scope="col">民宿管家</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareRows.map((row) => (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        {row.cells.map((cell, cellIndex) => (
                          <td key={cellIndex} className={cell.kind === "yes" ? "yes" : "note"}>
                            {cell.text}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="landing-section alt" id="features" aria-labelledby="features-heading">
          <div className="landing-wrap">
            <div className="landing-section-head center">
              <div className="landing-section-kicker">THE WORKBENCH</div>
              <h2 id="features-heading">
                不只是資料庫，
                <br />
                是每天會用到的工作台。
              </h2>
              <p className="landing-section-lead">
                把產品價值放在「下一步」而不是「更多欄位」。
              </p>
            </div>
            <div className="landing-feature-grid">
              {features.map((feature) => (
                <article key={feature.title} className="landing-feature-card">
                  <div className="landing-feature-icon" aria-hidden="true">
                    {feature.icon}
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="landing-section" id="pricing" aria-labelledby="pricing-heading">
          <div className="landing-wrap">
            <div className="landing-section-head center">
              <div className="landing-section-kicker">START SMALL, GROW CLEARLY</div>
              <h2 id="pricing-heading">
                先從一個物業開始，
                <br />
                需要時再往上長。
              </h2>
              <p className="landing-section-lead">
                方案沿用現有產品定位；正式上線前仍需確認實際限制與付款流程。
              </p>
            </div>
            <div className="landing-pricing-grid">
              {plans.map((plan) => (
                <article
                  key={plan.name}
                  className={`landing-price-card${plan.featured ? " featured" : ""}`}
                >
                  {plan.featured && plan.badge ? (
                    <span className="landing-price-badge">{plan.badge}</span>
                  ) : null}
                  <div className="landing-price-name">{plan.name}</div>
                  <div className="landing-price-value">
                    {plan.price} <small>/ 月</small>
                  </div>
                  <p className="landing-price-desc">{plan.desc}</p>
                  <ul className="landing-price-list">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <Link href={plan.href} className="landing-btn landing-btn-primary">
                    {plan.cta}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="landing-final-cta" aria-labelledby="final-cta-heading">
          <div className="landing-wrap">
            <div className="landing-cta-box">
              <div>
                <h2 id="final-cta-heading">你的下一個工作，應該一眼就看得到。</h2>
                <p>先看一個完整的營運畫面，再決定要不要把資料搬進來。</p>
              </div>
              <div className="landing-cta-actions">
                <Link href="/pricing" className="landing-btn landing-btn-primary">
                  免費看示範 <ArrowIcon width={16} height={16} />
                </Link>
                <Link href="/login" className="landing-btn-quiet">
                  登入系統
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="landing-footer" aria-labelledby="landing-footer-heading">
        <h2 id="landing-footer-heading" className="sr-only">
          頁尾導覽
        </h2>
        <div className="landing-wrap landing-footer-main">
          <div className="landing-footer-brand">
            <Link href="#top" className="landing-brand" aria-label="回到頂部">
              <span className="landing-brand-mark">
                <HouseIcon />
              </span>
              <span className="landing-brand-text">
                <span className="landing-brand-name">民宿管家</span>
                <span className="landing-brand-sub">PROPERTY OPERATIONS</span>
              </span>
            </Link>
            <p className="landing-footer-copy">
              給台灣民宿與包租代管業者的繁中營運工作台。
            </p>
          </div>
          <div>
            <h3>產品</h3>
            <a className="landing-footer-link" href="#workflow">
              怎麼工作
            </a>
            <a className="landing-footer-link" href="#features">
              功能
            </a>
            <Link className="landing-footer-link" href="/pricing">
              方案
            </Link>
          </div>
          <div>
            <h3>資源</h3>
            <a className="landing-footer-link" href="#compare">
              定位比較
            </a>
            <a className="landing-footer-link" href="#use-cases">
              使用情境
            </a>
            <Link className="landing-footer-link" href="/faq">
              FAQ
            </Link>
          </div>
          <div>
            <h3>公司</h3>
            <Link className="landing-footer-link" href="/contact">
              聯絡我們
            </Link>
            <Link className="landing-footer-link" href="/terms">
              服務條款
            </Link>
            <Link className="landing-footer-link" href="/privacy">
              隱私權
            </Link>
          </div>
          <div>
            <h3>帳號</h3>
            <Link className="landing-footer-link" href="/login">
              登入系統
            </Link>
          </div>
        </div>
        <div className="landing-wrap landing-footer-bottom">
          © 2026 hotel-pm · 民宿管家 · Demo data only · 繁體中文
        </div>
      </footer>
    </div>
  );
}
