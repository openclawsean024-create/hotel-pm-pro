// app/dashboard/reports/page.tsx — F-M6 月報表 + 自動拆帳
"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import Link from "next/link";

interface ReportProperty {
  propertyId: string;
  propertyName: string;
  monthlyRent: number;
  ownerSharePercent: number;
  bookingRevenue: number;
  bookingCount: number;
  totalIncome: number;
  ownerShareAmount: number;
  operatorShare: number;
  bookings: any[];
}

interface Report {
  month: string;
  properties: ReportProperty[];
  summary: { totalRevenue: number; totalOwnerShare: number; totalOperatorShare: number; propertyCount: number };
}

export default function ReportsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    else if (status === "authenticated") loadReport();
  }, [status, month, router]);

  async function loadReport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/monthly?month=${month}`);
      if (res.ok) {
        setReport(await res.json());
      } else {
        setReport(null);
      }
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">載入中...</div>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)]">
        <div className="container-page flex items-center justify-between py-4">
          <Link href="/dashboard" className="text-lg font-semibold">
            <span className="gradient-text">民宿管家</span>
          </Link>
          <Link href="/" className="btn-ghost text-sm">回首頁</Link>
        </div>
      </header>

      <main className="container-page py-8">
        <AppNav />

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">月報表 + 房東分潤</h1>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="input max-w-[200px]"
          />
        </div>

        {loading ? (
          <div className="card text-center py-12">載入中...</div>
        ) : !report ? (
          <div className="card text-center py-12">
            <p className="text-[var(--text-secondary)]">沒有資料。請先新增物業、房客、訂房。</p>
          </div>
        ) : (
          <>
            {/* Summary KPI */}
            <div className="grid gap-4 sm:grid-cols-4 mb-6">
              <div className="card">
                <div className="text-sm text-[var(--text-secondary)]">總收入</div>
                <div className="text-2xl font-bold mt-1">NT$ {report.summary.totalRevenue.toLocaleString()}</div>
              </div>
              <div className="card">
                <div className="text-sm text-[var(--text-secondary)]">房東分潤</div>
                <div className="text-2xl font-bold mt-1 text-[var(--gold)]">NT$ {report.summary.totalOwnerShare.toLocaleString()}</div>
              </div>
              <div className="card">
                <div className="text-sm text-[var(--text-secondary)]">管家分潤</div>
                <div className="text-2xl font-bold mt-1 text-[var(--accent)]">NT$ {report.summary.totalOperatorShare.toLocaleString()}</div>
              </div>
              <div className="card">
                <div className="text-sm text-[var(--text-secondary)]">物業數</div>
                <div className="text-2xl font-bold mt-1">{report.summary.propertyCount}</div>
              </div>
            </div>

            {/* Property breakdown */}
            {report.properties.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-[var(--text-secondary)]">本月沒有物業資料</p>
              </div>
            ) : (
              <div className="space-y-4">
                {report.properties.map((p) => (
                  <div key={p.propertyId} className="card">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-semibold">{p.propertyName}</h3>
                      <span className="text-sm text-[var(--text-secondary)]">房東分潤 {p.ownerSharePercent}%</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-4 text-sm">
                      <div>
                        <div className="text-[var(--text-muted)]">月租金</div>
                        <div className="font-medium">NT$ {p.monthlyRent.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[var(--text-muted)]">訂房收入</div>
                        <div className="font-medium">NT$ {p.bookingRevenue.toLocaleString()} ({p.bookingCount} 筆)</div>
                      </div>
                      <div>
                        <div className="text-[var(--text-muted)]">給房東</div>
                        <div className="font-medium text-[var(--gold)]">NT$ {p.ownerShareAmount.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[var(--text-muted)]">管家分潤</div>
                        <div className="font-medium text-[var(--accent)]">NT$ {p.operatorShare.toLocaleString()}</div>
                      </div>
                    </div>
                    {p.bookings.length > 0 && (
                      <details className="mt-3 text-sm">
                        <summary className="cursor-pointer text-[var(--text-secondary)]">查看 {p.bookings.length} 筆訂房</summary>
                        <table className="w-full mt-2 text-xs">
                          <thead>
                            <tr className="border-b border-[var(--border)]">
                              <th className="text-left p-2">房客</th>
                              <th className="text-left p-2">入住</th>
                              <th className="text-right p-2">總價</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.bookings.map((b: any) => (
                              <tr key={b.id} className="border-b border-[var(--border)]/50">
                                <td className="p-2">{b.guestName}</td>
                                <td className="p-2 text-[var(--text-secondary)]">{b.checkIn.slice(0, 10)}</td>
                                <td className="p-2 text-right">NT$ {b.totalPrice.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
