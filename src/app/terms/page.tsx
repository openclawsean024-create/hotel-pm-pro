// app/terms/page.tsx
import Link from "next/link";

export const metadata = { title: "服務條款" };

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold mb-2">服務條款</h1>
        <p className="text-sm text-[var(--text-muted)] mb-8">最後更新：2026-08-02</p>

        <section className="space-y-8">
          <div>
            <h2 className="text-xl font-bold mb-2">1. 服務說明</h2>
            <p className="text-[var(--text-secondary)]">民宿管家（hotel-pm）提供民宿與包租代管業者的物業管理系統，包括但不限於：物業資料管理、房客資料管理、訂房行事曆、月報表 PDF 匯出等。</p>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-2">2. 帳號責任</h2>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-1">
              <li>你必須提供真實、完整的註冊資料</li>
              <li>密碼應妥善保管，不可分享</li>
              <li>帳號下所有活動由你負責</li>
              <li>發現未授權使用應立即通知我們</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-2">3. 訂閱與付費</h2>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-1">
              <li>Pro 與 Business 方案採月訂閱制</li>
              <li>首月 14 天試用期內全額退款</li>
              <li>後續取消按比例退款到原始付款方式</li>
              <li>方案升級立即生效，按比例計算差額</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-2">4. 使用規範</h2>
            <p className="text-[var(--text-secondary)] mb-2">禁止以下行為：</p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-1">
              <li>用於非法用途</li>
              <li>嘗試入侵、干擾服務運作</li>
              <li>濫用服務造成其他用戶困擾</li>
              <li>未經授權散布服務內容</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-2">5. 智慧財產</h2>
            <p className="text-[var(--text-secondary)]">民宿管家的所有商標、logo、程式碼、設計均為我們所有。授權你個人 / 商業使用，但不可複製、修改、散布。</p>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-2">6. 服務變更與終止</h2>
            <p className="text-[var(--text-secondary)]">我們保留隨時修改或終止服務的權利。重大變更將於 30 天前 email 通知。終止服務將按比例退款。</p>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-2">7. 免責聲明</h2>
            <p className="text-[var(--text-secondary)]">服務以「現狀」提供，不保證無中斷或錯誤。我們不對因服務中斷、資料遺失造成的損失負責。</p>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-2">8. 爭議處理</h2>
            <p className="text-[var(--text-secondary)]">本條款依中華民國法律解釋。爭議以台灣台北地方法院為第一審管轄法院。</p>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-2">9. 聯絡</h2>
            <p className="text-[var(--text-secondary)]">條款相關問題：<Link href="/contact" className="text-[var(--accent)] hover:underline">聯絡我們</Link></p>
          </div>
        </section>
      </main>
    </div>
  );
}
