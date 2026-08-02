// app/faq/page.tsx
import Link from "next/link";

export const metadata = { title: "常見問題" };

const FAQS = [
  { q: "民宿管家是什麼？", a: "民宿管家（hotel-pm）是專為台灣民宿與包租代管業者設計的純前端物業管理系統（PMS），提供物業、房客、訂房、月報表四大模組。" },
  { q: "跟 Excel 或 Cloudbeds 比，有什麼差別？", a: "Excel：免費但要手動整理、月報表要自己算。Cloudbeds：好用但月費 USD 80+ 對 1-10 房民宿太貴。民宿管家：月費 NT$499、繁中在地化、零後端維運。" },
  { q: "資料放在哪裡？", a: "Free 方案：瀏覽器 localStorage。Pro / Business 方案：雲端同步到 Supabase（位於新加坡），AES-256 加密。" },
  { q: "可以匯入既有資料嗎？", a: "可以，Pro 方案支援 CSV 匯入。匯入流程在「設定 > 資料管理」中。" },
  { q: "支援哪些平台瀏覽器？", a: "Chrome / Edge / Safari / Firefox 最新版本。手機優先設計，平板與桌機皆可用。" },
  { q: "有 API 嗎？", a: "Business 方案有完整 REST API，可串接外部系統（會計、CRM 等）。" },
  { q: "可以串接 Airbnb / Booking.com 嗎？", a: "可以，Pro 方案支援 ICS 自動匯入訂房。" },
  { q: "如何聯絡客服？", a: "Email 客服在 1-2 個工作天回覆。Business 方案 24hr 內回覆。" },
  { q: "可以退款嗎？", a: "首次訂閱 14 天內全額退款。之後按比例退款到原始付款方式。" },
  { q: "提供教育訓練嗎？", a: "Pro 方案含 1 小時 onboarding 視訊。Business 方案含 4 小時客製化教育訓練。" },
];

export default function FaqPage() {
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

      <main className="container-page py-16 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">常見問題</h1>
        <p className="text-[var(--text-secondary)] mb-8">找不到答案？<Link href="/contact" className="text-[var(--accent)] hover:underline">聯絡我們</Link></p>

        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <details key={i} className="card">
              <summary className="font-medium cursor-pointer">{f.q}</summary>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">{f.a}</p>
            </details>
          ))}
        </div>
      </main>
    </div>
  );
}
