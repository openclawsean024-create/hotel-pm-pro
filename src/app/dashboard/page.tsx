// app/dashboard/page.tsx — 受保護的 dashboard
"use client";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Property {
  id: string;
  name: string;
  address: string;
  roomType: string;
  area: number | null;
  monthlyRent: number;
  ownerShare: number;
  _count?: { tenants: number; bookings: number };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", roomType: "整層", area: "", monthlyRent: "", ownerShare: "80" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      loadProperties();
    }
  }, [status, router]);

  async function loadProperties() {
    setLoading(true);
    try {
      const res = await fetch("/api/properties");
      const data = await res.json();
      setProperties(data.properties ?? []);
    } catch (err) {
      setError("載入失敗");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          area: form.area ? Number(form.area) : null,
          monthlyRent: Number(form.monthlyRent),
          ownerShare: Number(form.ownerShare),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "新增失敗");
        return;
      }
      setForm({ name: "", address: "", roomType: "整層", area: "", monthlyRent: "", ownerShare: "80" });
      setShowAdd(false);
      loadProperties();
    } catch (err) {
      setError("新增失敗");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("確定要刪除此物業嗎？")) return;
    try {
      const res = await fetch(`/api/properties/${id}`, { method: "DELETE" });
      if (res.ok) loadProperties();
    } catch (err) {
      setError("刪除失敗");
    }
  }

  if (status === "loading" || loading) {
    return <div className="min-h-screen flex items-center justify-center">載入中...</div>;
  }

  const totalMonthlyRent = properties.reduce((sum, p) => sum + p.monthlyRent, 0);
  const totalProperties = properties.length;
  const tier = (session?.user as any)?.tier ?? "free";

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="border-b border-[var(--border)]">
        <div className="container-page flex items-center justify-between py-4">
          <Link href="/" className="text-lg font-semibold">
            <span className="gradient-text">民宿管家</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--text-secondary)]">
              {session?.user?.email}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] font-semibold">
              {tier}
            </span>
            {tier === "free" && (
              <Link href="/pricing" className="btn-primary text-sm">升級</Link>
            )}
            <button onClick={() => signOut({ callbackUrl: "/" })} className="btn-ghost text-sm">登出</button>
          </div>
        </div>
      </header>

      <main className="container-page py-8">
        {/* KPI */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <div className="card">
            <div className="text-sm text-[var(--text-secondary)]">物業總數</div>
            <div className="text-3xl font-bold mt-1">{totalProperties}</div>
          </div>
          <div className="card">
            <div className="text-sm text-[var(--text-secondary)]">月租金總額</div>
            <div className="text-3xl font-bold mt-1">NT$ {totalMonthlyRent.toLocaleString()}</div>
          </div>
          <div className="card">
            <div className="text-sm text-[var(--text-secondary)]">方案</div>
            <div className="text-3xl font-bold mt-1 capitalize">{tier}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">我的物業</h1>
          <button onClick={() => setShowAdd(!showAdd)} className="btn-primary">
            {showAdd ? "取消" : "+ 新增物業"}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}

        {/* Add form */}
        {showAdd && (
          <form onSubmit={handleAdd} className="card mb-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">名稱</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="label">地址</label>
              <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
            </div>
            <div>
              <label className="label">房型</label>
              <select className="input" value={form.roomType} onChange={(e) => setForm({ ...form, roomType: e.target.value })}>
                <option>整層</option>
                <option>套房</option>
                <option>雅房</option>
              </select>
            </div>
            <div>
              <label className="label">坪數</label>
              <input className="input" type="number" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
            </div>
            <div>
              <label className="label">月租金 (NT$)</label>
              <input className="input" type="number" value={form.monthlyRent} onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })} required />
            </div>
            <div>
              <label className="label">房東分潤 (%)</label>
              <input className="input" type="number" min="0" max="100" value={form.ownerShare} onChange={(e) => setForm({ ...form, ownerShare: e.target.value })} required />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary">建立物業</button>
            </div>
          </form>
        )}

        {/* Property list */}
        {properties.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-[var(--text-secondary)]">還沒有物業，點「+ 新增物業」開始</p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left p-3">名稱</th>
                  <th className="text-left p-3">地址</th>
                  <th className="text-left p-3">房型</th>
                  <th className="text-right p-3">月租</th>
                  <th className="text-right p-3">分潤</th>
                  <th className="text-right p-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--border)]/50">
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3 text-[var(--text-secondary)]">{p.address}</td>
                    <td className="p-3 text-[var(--text-secondary)]">{p.roomType}</td>
                    <td className="p-3 text-right">NT$ {p.monthlyRent.toLocaleString()}</td>
                    <td className="p-3 text-right">{p.ownerShare}%</td>
                    <td className="p-3 text-right">
                      <button onClick={() => handleDelete(p.id)} className="text-[var(--danger)] hover:underline text-sm">刪除</button>
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
