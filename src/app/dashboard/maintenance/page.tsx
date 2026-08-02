// app/dashboard/maintenance/page.tsx — F-M5 維修派工 (minimal compile version)
"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import Link from "next/link";

interface Maintenance {
  id: string;
  propertyId: string;
  title: string;
  estimatedCost: number;
  status: string;
  createdAt: string;
}

interface Property { id: string; name: string; }

export default function MaintenancePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    propertyId: "",
    title: "",
    estimatedCost: "",
    startDate: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    else if (status === "authenticated") loadAll();
  }, [status, router]);

  async function loadAll() {
    setLoading(true);
    try {
      const [m, p] = await Promise.all([
        fetch("/api/maintenance").then((r) => r.json()),
        fetch("/api/properties").then((r) => r.json()),
      ]);
      setMaintenances(m.maintenances ?? []);
      setProperties(p.properties ?? []);
      if (!form.propertyId && p.properties?.[0]) {
        setForm({ ...form, propertyId: p.properties[0].id });
      }
    } catch {
      setError("載入失敗");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: form.propertyId,
          title: form.title,
          estimatedCost: Number(form.estimatedCost || 0),
          startDate: form.startDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "新增失敗");
        return;
      }
      setShowAdd(false);
      loadAll();
    } catch {
      setError("新增失敗");
    }
  }

  if (status === "loading" || loading) {
    return <div className="min-h-screen flex items-center justify-center">載入中...</div>;
  }

  const propName = (id: string) => properties.find((p) => p.id === id)?.name ?? "—";

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
          <h1 className="text-2xl font-bold">維修派工</h1>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="btn-primary"
            disabled={properties.length === 0}
            title={properties.length === 0 ? "請先新增物業" : ""}
          >
            {showAdd ? "取消" : "+ 派工"}
          </button>
        </div>

        {properties.length === 0 && (
          <div className="mb-4 p-3 rounded-md bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-sm">
            請先到「物業」頁新增至少一筆物業。
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-md bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}

        {showAdd && (
          <form onSubmit={handleAdd} className="card mb-6">
            <div>
              <label>物業</label>
              <select value={form.propertyId} onChange={(e) => setForm({...form, propertyId: e.target.value})}>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label>標題</label>
              <input className="input" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} required />
            </div>
            <div>
              <label>預估費用</label>
              <input className="input" type="number" value={form.estimatedCost} onChange={(e) => setForm({...form, estimatedCost: e.target.value})} />
            </div>
            <div>
              <label>開始日期</label>
              <input className="input" type="date" value={form.startDate} onChange={(e) => setForm({...form, startDate: e.target.value})} required />
            </div>
            <button type="submit" className="btn-primary">派工</button>
          </form>
        )}

        {maintenances.length === 0 ? (
          <div className="card text-center py-12">還沒有維修單，快來點「+ 派工」吧！</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left p-3">物業</th>
                  <th className="text-left p-3">標題</th>
                  <th className="text-right p-3">預估</th>
                  <th className="text-left p-3">狀態</th>
                  <th className="text-right p-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {maintenances.map((m) => (
                  <tr key={m.id} className="border-b border-[var(--border)]/50">
                    <td className="p-3">{propName(m.propertyId)}</td>
                    <td className="p-3">{m.title}</td>
                    <td className="p-3 text-right">NT$ {m.estimatedCost.toLocaleString()}</td>
                    <td className="p-3">{m.status.toUpperCase()}</td>
                    <td className="p-3 text-right">
                      <button className="text-xs text-[var(--danger)] hover:underline" onClick={() => {
                        fetch(`/api/maintenance/${m.id}`, { method: "DELETE" });
                        loadAll();
                      }}>
                        刪除
                      </button>
                    </td>
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