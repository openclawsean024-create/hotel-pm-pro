// app/page.tsx — Landing page
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="border-b border-[var(--border)]">
        <div className="container-page flex items-center justify-between py-4">
          <Link href="/" className="text-lg font-semibold">
            <span className="gradient-text">民宿管家 hotel-pm</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/pricing" className="btn-ghost text-sm">定價</Link>
            <Link href="/faq" className="btn-ghost text-sm">FAQ</Link>
            <Link href="/login" className="btn-ghost text-sm">登入</Link>
            <Link href="/login" className="btn-primary text-sm">登入系統</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container-page py-20 sm:py-28 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1 text-xs text-[var(--text-secondary)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]"></span>
          台灣民宿 / 包租代管專用
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
          <span className="gradient-text">民宿管家</span>
          <br />
          <span className="text-[var(--text-primary)]">月費 NT$499 起</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-secondary)]">
          純前端 SPA + 雲端同步，零後端維運成本。<br />
          比 Cloudbeds 便宜 80%，比 Excel 簡單 10 倍。
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login" className="btn-primary">登入系統</Link>
          <Link href="/pricing" className="btn-secondary">看定價方案</Link>
        </div>
      </section>

      {/* Features */}
      <section className="container-page py-16">
        <h2 className="text-3xl font-bold text-center mb-12">核心功能</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: "🏘️", title: "物業管理", desc: "地址、房型、坪數、月租金、分潤比例" },
            { icon: "👥", title: "房客管理", desc: "合約期間、聯絡方式、月繳通知" },
            { icon: "📅", title: "訂房行事曆", desc: "Airbnb / Booking.com ICS 自動匯入" },
            { icon: "📊", title: "月報表 PDF", desc: "一鍵匯出給會計師與房東的拆帳單" },
          ].map((f) => (
            <div key={f.title} className="card hover:border-[var(--accent)] transition">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing summary */}
      <section className="container-page py-16">
        <h2 className="text-3xl font-bold text-center mb-12">簡單定價</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { name: "Free", price: "NT$0", desc: "5 房以內", features: ["5 房管理", "月報表 PDF", "基礎客服"] },
            { name: "Pro", price: "NT$499", desc: "20 房以內", features: ["20 房管理", "ICS 自動匯入", "Email 客服", "拆帳自動計算"], highlight: true },
            { name: "Business", price: "NT$1,499", desc: "無限房", features: ["無限房", "團隊帳號", "優先客服", "API 串接"] },
          ].map((p) => (
            <div key={p.name} className={`card ${p.highlight ? "border-[var(--accent)]" : ""}`}>
              <h3 className="text-xl font-semibold">{p.name}</h3>
              <div className="mt-4 mb-4">
                <span className="text-3xl font-bold">{p.price}</span>
                <span className="text-[var(--text-muted)]"> /月</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mb-4">{p.desc}</p>
              <ul className="space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-[var(--accent)]">✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link href="/pricing" className="btn-secondary">看完整方案比較</Link>
        </div>
      </section>

      {/* CTA */}
      <section className="container-page py-20 text-center">
        <div className="card max-w-2xl mx-auto p-12">
          <h2 className="text-3xl font-bold">準備好了嗎？</h2>
          <p className="mt-4 text-[var(--text-secondary)]">已有帳號即可登入使用物業管理功能。</p>
          <Link href="/login" className="btn-primary mt-6 inline-flex">前往登入</Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] mt-20">
        <div className="container-page py-8 grid gap-8 sm:grid-cols-4 text-sm">
          <div>
            <h4 className="font-semibold mb-3">民宿管家</h4>
            <p className="text-[var(--text-secondary)]">台灣民宿 / 包租代管 PMS</p>
          </div>
          <div>
            <h4 className="font-semibold mb-3">產品</h4>
            <ul className="space-y-2 text-[var(--text-secondary)]">
              <li><Link href="/pricing">定價</Link></li>
              <li><Link href="/faq">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">公司</h4>
            <ul className="space-y-2 text-[var(--text-secondary)]">
              <li><Link href="/contact">聯絡我們</Link></li>
              <li><Link href="/terms">服務條款</Link></li>
              <li><Link href="/privacy">隱私權</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">帳號</h4>
            <ul className="space-y-2 text-[var(--text-secondary)]">
              <li><Link href="/login">登入</Link></li>
            </ul>
          </div>
        </div>
        <div className="container-page py-4 text-center text-xs text-[var(--text-muted)]">
          © 2026 hotel-pm · 純前端 + 雲端 · 繁體中文
        </div>
      </footer>
    </div>
  );
}
