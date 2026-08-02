// app/dashboard/tenants/page.tsx — F-M2 房客 CRM
"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import Link from "next/link";

interface Tenant {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  propertyId: string;
  startDate: string;
  endDate: string | null;
  monthlyRent: number;
  deposit: number;
  status: string;
}

interface Property { id: string; name: string; }

export default function TenantsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    propertyId: "", name: "", phone: "", email: "",
    startDate: "", endDate: "", monthlyRent: "", deposit: "0",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    else if (status === "authenticated") loadAll();
  }, [status, router]);

  async function loadAll() {
    setLoading(true);
    try {
      const [t, p] = await Promise.all([
        fetch("/api/tenants").then((r) => r.json()),
        fetch("/api/properties").then((r) => r.json()),
      ]);
      setTenants(t.tenants ?? []);
      setProperties(p.properties ?? []);
      if (!form.propertyId && p.properties?.[0]) {
        setForm((f) => ({ ...f, propertyId: p.properties[0].id }));
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
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: form.propertyId,
          name: form.name,
          phone: form.phone,
          email: form.email || undefined,
          startDate: form.startDate,
          endDate: form.endDate || undefined,
          monthlyRent: Number(form.monthlyRent),
          deposit: Number(form.deposit || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "新增失敗");
        return;
      }
      setForm({ ...form, name: "", phone: "", email: "", startDate: "", endDate: "", monthlyRent: "", deposit: "0" });
      setShowAdd(false);
      loadAll();
    } catch {
      setError("新增失敗");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("確定刪除此房客？")) return;
    await fetch(`/api/tenants/${id}`, { method: "DELETE" });
    loadAll();
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
          <h1 className="text-2xl font-bold">房客管理</h1>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="btn-primary"
            disabled={properties.length === 0}
            title={properties.length === 0 ? "請先新增物業" : ""}
          >
            {showAdd ? "取消" : "+ 新增房客"}
          </button>
        </div>

        {properties.length === 0 && (
          <div className="mb-4 p-3 rounded-md bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-sm">
            請先到「物業」頁新增至少一筆物業，才能新增房客。
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-md bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}

        {showAdd && (
          <form onSubmit={handleAdd} className="card mb-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">物業</label>
              <select className="input" value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: e.target.value })} required>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">姓名</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="label">電話</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">起租日</label>
              <input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
            </div>
            <div>
              <label className="label">退租日（選填）</label>
              <input className="input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div>
              <label className="label">月租金 (NT$)</label>
              <input className="input" type="number" value={form.monthlyRent} onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })} required />
            </div>
            <div>
              <label className="label">押金 (NT$)</label>
              <input className="input" type="number" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary">建立房客</button>
            </div>
          </form>
        )}

        {tenants.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-[var(--text-secondary)]">還沒有房客，點「+ 新增房客」開始</p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left p-3">姓名</th>
                  <th className="text-left p-3">電話</th>
                  <th className="text-left p-3">物業</th>
                  <th className="text-left p-3">起租日</th>
                  <th className="text-right p-3">月租</th>
                  <th className="text-center p-3">狀態</th>
                  <th className="text-right p-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--border)]/50">
                    <td className="p-3 font-medium">{t.name}</td>
                    <td className="p-3 text-[var(--text-secondary)]">{t.phone}</td>
                    <td className="p-3 text-[var(--text-secondary)]">{propName(t.propertyId)}</td>
                    <td className="p-3 text-[var(--text-secondary)]">{t.startDate.slice(0, 10)}</td>
                    <td className="p-3 text-right">NT$ {t.monthlyRent.toLocaleString()}</td>
                    <td className="p-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded ${t.status === "active" ? "bg-[var(--success)]/10 text-[var(--success)]" : "bg-[var(--text-muted)]/10 text-[var(--text-muted)]"}`}>
                        {t.status === "active" ? "租賃中" : "已退租"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button onClick={() => handleDelete(t.id)} className="text-[var(--danger)] hover:underline text-sm">刪除</button>
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
