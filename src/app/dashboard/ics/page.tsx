// app/dashboard/ics/page.tsx — F-M9 ICS 同步
"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";

interface Property { id: string; name: string; }

interface IcsEventResult {
  uid: string;
  summary: string;
  checkIn: string;
  checkOut: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  events: IcsEventResult[];
}

export default function IcsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    propertyId: "",
    icsUrl: "",
    source: "airbnb",
  });
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    else if (status === "authenticated") loadProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router]);

  async function loadProperties() {
    setLoading(true);
    try {
      const res = await fetch("/api/properties");
      const data = await res.json();
      const list: Property[] = data.properties ?? [];
      setProperties(list);
      setForm((f) => (f.propertyId ? f : { ...f, propertyId: list[0]?.id ?? "" }));
    } catch {
      setError("載入物業失敗");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setImporting(true);
    try {
      const res = await fetch("/api/ics/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "匯入失敗");
        return;
      }
      setResult(data);
      setForm((f) => ({ ...f, icsUrl: "" }));
    } catch {
      setError("匯入失敗，請稍後再試");
    } finally {
      setImporting(false);
    }
  }

  if (status === "loading" || loading) {
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
          <h1 className="text-2xl font-bold">ICS 同步</h1>
        </div>

        {properties.length === 0 && (
          <div className="mb-4 p-3 rounded-md bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-sm">
            請先到「物業」頁新增至少一筆物業，才能同步 ICS 訂房。
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-md bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}

        {result && (
          <div className="mb-4 p-3 rounded-md bg-[var(--success)]/10 border border-[var(--success)]/30 text-sm text-[var(--success)]">
            匯入完成：新匯入 <strong>{result.imported}</strong> 筆，略過 <strong>{result.skipped}</strong> 筆（重複 UID）
          </div>
        )}

        {properties.length > 0 && (
          <form onSubmit={handleImport} className="card mb-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">物業</label>
              <select
                className="input"
                value={form.propertyId}
                onChange={(e) => setForm({ ...form, propertyId: e.target.value })}
                required
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">來源</label>
              <select
                className="input"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              >
                <option value="airbnb">Airbnb</option>
                <option value="booking">Booking.com</option>
                <option value="manual">手動</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">ICS 訂房連結</label>
              <input
                className="input"
                type="url"
                placeholder="https://www.airbnb.com/calendar/ical/..."
                value={form.icsUrl}
                onChange={(e) => setForm({ ...form, icsUrl: e.target.value })}
                required
              />
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                從 Airbnb / Booking.com 行事曆設定頁複製 iCal 連結。
              </p>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary" disabled={importing}>
                {importing ? "匯入中..." : "匯入"}
              </button>
            </div>
          </form>
        )}

        <div className="card text-sm text-[var(--text-secondary)]">
          <p>貼上 Airbnb / Booking.com 的 ICS 訂房連結，按下匯入後會自動同步訂房。</p>
          <p className="mt-2">
            每個 event 會以 UID 去重，已匯入過的不會重複建立。資料存進 <code>IcsEvent</code> 表，
            目前僅供檢視，尚未自動建立 <code>Booking</code> 訂房紀錄。
          </p>
        </div>

        {result && result.events.length > 0 && (
          <div className="card overflow-x-auto mt-6">
            <h2 className="text-lg font-semibold mb-3">本次匯入事件</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left p-3">UID</th>
                  <th className="text-left p-3">摘要</th>
                  <th className="text-left p-3">入住</th>
                  <th className="text-left p-3">退房</th>
                </tr>
              </thead>
              <tbody>
                {result.events.map((e) => (
                  <tr key={e.uid} className="border-b border-[var(--border)]/50">
                    <td className="p-3 text-xs text-[var(--text-secondary)] font-mono break-all">
                      {e.uid}
                    </td>
                    <td className="p-3">{e.summary}</td>
                    <td className="p-3 text-[var(--text-secondary)]">{e.checkIn.slice(0, 10)}</td>
                    <td className="p-3 text-[var(--text-secondary)]">{e.checkOut.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
