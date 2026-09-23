// app/pricing/page.tsx
import Link from "next/link";

export const metadata = { title: "定價方案" };

export default function PricingPage() {
  const plans = [
    {
      name: "Free",
      price: "NT$0",
      period: "永久",
      desc: "1 民宿 / 5 房以內",
      features: [
        "1 個物業",
        "5 房以內",
        "月報表 PDF 匯出",
        "基礎 Email 客服",
        "資料本地儲存",
      ],
      cta: "登入使用",
      href: "/login",
      highlight: false,
    },
    {
      name: "Pro",
      price: "NT$499",
      period: "/月",
      desc: "中型民宿 / 1 站 1 民宿",
      features: [
        "5 個物業",
        "20 房以內",
        "ICS 自動匯入 (Airbnb/Booking)",
        "拆帳自動計算",
        "Email 客服",
        "雲端同步",
        "資料匯出 CSV",
      ],
      cta: "升級 Pro",
      href: "/checkout?plan=pro",
      highlight: true,
    },
    {
      name: "Business",
      price: "NT$1,499",
      period: "/月",
      desc: "包租代管 / 多物業",
      features: [
        "無限物業",
        "無限房數",
        "5 個團隊帳號",
        "API 串接",
        "優先客服（24hr 內回覆）",
        "白標選項",
        "完整審計日誌",
      ],
      cta: "聯絡業務",
      href: "/contact",
      highlight: false,
    },
  ];

  const faqs = [
    { q: "可以隨時取消嗎？", a: "可以，Pro 與 Business 方案隨時取消，目前週期仍可使用至到期日。" },
    { q: "目前可以申請帳號嗎？", a: "目前暫停開放新帳號；已有帳號的使用者可以直接登入。" },
    { q: "支援哪些付款方式？", a: "支援信用卡（Visa / MasterCard / JCB）與 LINE Pay。" },
    { q: "可以升級或降級嗎？", a: "可以，隨時在帳號設定中切換方案，按比例計算費用。" },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)]">
        <div className="container-page flex items-center justify-between py-4">
          <Link href="/" className="text-lg font-semibold">
            <span className="gradient-text">民宿管家</span>
          </Link>
          <Link href="/" className="btn-ghost text-sm">← 回首頁</Link>
        </div>
      </header>

      <main className="container-page py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold">簡單透明的定價</h1>
          <p className="mt-4 text-[var(--text-secondary)]">選擇最適合你的方案，隨時可升級或降級</p>
        </div>

        {/* Plans */}
        <div className="grid gap-6 md:grid-cols-3 mb-16">
          {plans.map((p) => (
            <div key={p.name} className={`card ${p.highlight ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20" : ""}`}>
              {p.highlight && (
                <span className="inline-block text-xs font-semibold text-[var(--accent)] mb-2">最受歡迎</span>
              )}
              <h2 className="text-2xl font-bold">{p.name}</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">{p.desc}</p>
              <div className="mt-6 mb-6">
                <span className="text-4xl font-bold">{p.price}</span>
                <span className="text-[var(--text-muted)] ml-1">{p.period}</span>
              </div>
              <ul className="space-y-3 text-sm mb-6 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="text-[var(--accent)] mt-0.5">✓</span> <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href={p.href} className={p.highlight ? "btn-primary w-full justify-center" : "btn-secondary w-full justify-center"}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Comparison */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">方案比較</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left p-3">功能</th>
                  <th className="text-center p-3">Free</th>
                  <th className="text-center p-3">Pro</th>
                  <th className="text-center p-3">Business</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["物業數量", "1", "5", "無限"],
                  ["房數", "5", "20", "無限"],
                  ["ICS 自動匯入", "—", "✓", "✓"],
                  ["拆帳計算", "—", "✓", "✓"],
                  ["團隊帳號", "—", "—", "5 個"],
                  ["API 串接", "—", "—", "✓"],
                  ["雲端同步", "—", "✓", "✓"],
                  ["客服", "Email", "Email", "優先"],
                ].map(([f, free, pro, biz], i) => (
                  <tr key={i} className="border-b border-[var(--border)]/50">
                    <td className="p-3 font-medium">{f}</td>
                    <td className="p-3 text-center text-[var(--text-secondary)]">{free}</td>
                    <td className="p-3 text-center text-[var(--text-secondary)]">{pro}</td>
                    <td className="p-3 text-center text-[var(--text-secondary)]">{biz}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pricing FAQ */}
        <div>
          <h2 className="text-2xl font-bold text-center mb-8">定價常見問題</h2>
          <div className="max-w-2xl mx-auto space-y-4">
            {faqs.map((f, i) => (
              <details key={i} className="card">
                <summary className="font-medium cursor-pointer">{f.q}</summary>
                <p className="mt-3 text-sm text-[var(--text-secondary)]">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
