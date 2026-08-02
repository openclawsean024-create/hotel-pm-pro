// app/privacy/page.tsx
import Link from "next/link";

export const metadata = { title: "隱私權政策" };

export default function PrivacyPage() {
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

      <main className="container-page py-16 max-w-3xl prose prose-invert">
        <h1>隱私權政策</h1>
        <p className="text-sm text-[var(--text-muted)]">最後更新：2026-08-02</p>

        <h2>1. 資料蒐集</h2>
        <p>我們蒐集以下資料：</p>
        <ul>
          <li>帳號資料：姓名、email、密碼（bcrypt 雜湊）</li>
          <li>付費資料：信用卡末四碼（由 Stripe 處理，<strong>我們不儲存完整卡號</strong>）</li>
          <li>使用資料：物業、房客、訂房紀錄（CRM 用途）</li>
          <li>技術資料：IP、瀏覽器 User-Agent（用於安全與除錯）</li>
        </ul>

        <h2>2. 資料使用</h2>
        <p>蒐集的資料只用於：</p>
        <ul>
          <li>提供服務（物業管理、月報表）</li>
          <li>帳號驗證與安全</li>
          <li>付款處理（透過 Stripe）</li>
          <li>客服支援</li>
        </ul>
        <p>我們<strong>不會</strong>出售、租賃或分享你的個資給第三方（除付款處理商 Stripe 與 DB 託管的 Supabase）。</p>

        <h2>3. 資料儲存與安全</h2>
        <ul>
          <li>密碼以 bcrypt 10 rounds 雜湊儲存（不可逆）</li>
          <li>DB 連線使用 TLS 1.3 加密</li>
          <li>DB 主機在新加坡 Supabase（ISO 27001、SOC 2 Type II 認證）</li>
          <li>每日自動備份，保留 7 天</li>
        </ul>

        <h2>4. GDPR / 台灣個資法 / CCPA 權利</h2>
        <p>你可隨時行使以下權利：</p>
        <ul>
          <li><strong>查詢 / 存取</strong>：在「設定 &gt; 資料匯出」下載你的所有資料</li>
          <li><strong>更正</strong>：在「設定 &gt; 帳號」中修改</li>
          <li><strong>刪除</strong>：在「設定 &gt; 刪除帳號」中，7 天內從 DB 完全清除</li>
          <li><strong>資料可攜性</strong>：所有資料可匯出為 JSON 格式</li>
        </ul>

        <h2>5. Cookie 使用</h2>
        <p>本站使用必要 cookie（登入 session CSRF token），不使用追蹤 / 行銷 cookie。</p>

        <h2>6. 第三方服務</h2>
        <ul>
          <li><strong>Stripe</strong>（付款處理，PCI DSS Level 1 認證）</li>
          <li><strong>Supabase</strong>（DB 託管，SOC 2 Type II）</li>
          <li><strong>Vercel</strong>（網站託管）</li>
        </ul>

        <h2>7. 聯絡</h2>
        <p>個資相關問題：<a href="/contact">聯絡我們</a></p>
      </main>
    </div>
  );
}
