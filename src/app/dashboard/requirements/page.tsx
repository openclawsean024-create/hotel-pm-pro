// app/dashboard/requirements/page.tsx — F-M4 需求記錄（建立／編輯／狀態更新／刪除，FR-014）
"use client";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import Link from "next/link";

interface Requirement {
  id: string;
  propertyId: string;
  category: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  open: "待處理",
  in_progress: "處理中",
  resolved: "已解決",
  closed: "已結案",
};
const PRIORITY_LABEL: Record<string, string> = { low: "低", normal: "中", high: "高", urgent: "急" };

interface Property { id: string; name: string; }

export default function RequirementsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    propertyId: "",
    category: "repair",
    title: "",
    description: "",
    priority: "normal",
  });
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", priority: "normal", status: "open" });
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([
        fetch("/api/requirements").then((r) => r.json()),
        fetch("/api/properties").then((r) => r.json()),
      ]);
      setRequirements(r.requirements ?? []);
      setProperties(p.properties ?? []);
      const first = p.properties?.[0];
      if (first) setForm((f) => (f.propertyId ? f : { ...f, propertyId: first.id }));
    } catch {
      setError("載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    else if (status === "authenticated") void loadAll();
  }, [status, router, loadAll]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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

  function startEdit(r: Requirement) {
    setError("");
    setEditingId(r.id);
    setEditForm({ title: r.title, description: r.description ?? "", priority: r.priority, status: r.status });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/requirements/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "儲存失敗");
        return;
      }
      setEditingId(null);
      await loadAll();
    } catch {
      setError("儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("確定刪除此需求？")) return;
    await fetch(`/api/requirements/${id}`, { method: "DELETE" });
    await loadAll();
  }

  if (status === "loading" || loading) {
    return <div className="min-h-screen flex items-center justify-center">載入中...</div>;
  }

  const propName = (id: string) => properties.find((p) => p.id === id)?.name ?? "—";
  const catText = (c: string) => c === "repair" ? "維修" : c === "special_request" ? "特殊需求" : c === "cleaning_note" ? "清潔備註" : "其他";

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
          <h1 className="text-2xl font-bold">需求記錄</h1>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="btn-primary"
            disabled={properties.length === 0}
            title={properties.length === 0 ? "請先新增物業" : ""}
          >
            {showAdd ? "取消" : "+ 新增需求"}
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
          <form onSubmit={handleAdd} className="card mb-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label>物業</label>
              <select value={form.propertyId} onChange={(e) => setForm({...form, propertyId: e.target.value})}>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label>類別</label>
              <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}>
                <option value="repair">維修</option>
                <option value="special_request">特殊需求</option>
                <option value="cleaning_note">清潔備註</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div className="sm:col-span-2"><label>標題</label><input className="input" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} required /></div>
            <div className="sm:col-span-2"><label>描述</label><textarea className="input" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} rows={3} required /></div>
            <div><label>優先級</label><select value={form.priority} onChange={(e) => setForm({...form, priority: e.target.value})}>
              <option value="low">低</option><option value="normal">中</option><option value="high">高</option><option value="urgent">急</option>
            </select></div>
            <div className="sm:col-span-2"><button type="submit" className="btn-primary">建立需求</button></div>
          </form>
        )}

        {requirements.length === 0 ? (
          <div className="card text-center py-12"><p className="text-[var(--text-secondary)]">還沒有需求記錄</p></div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)]">
                <th className="text-left p-3">物業</th>
                <th className="text-left p-3">類別</th>
                <th className="text-left p-3">標題</th>
                <th className="text-left p-3">優先級</th>
                <th className="text-left p-3">狀態</th>
                <th className="text-right p-3">操作</th>
              </tr></thead>
              <tbody>
                {requirements.map(r => editingId === r.id ? (
                  <tr key={r.id} className="border-b border-[var(--border)]/50" data-testid="requirement-edit-row">
                    <td colSpan={6} className="p-3">
                      <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-2" aria-label="編輯需求">
                        <div className="sm:col-span-2">
                          <label className="label" htmlFor="edit-title">標題</label>
                          <input id="edit-title" className="input" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required maxLength={200} />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="label" htmlFor="edit-description">描述</label>
                          <textarea id="edit-description" className="input" rows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} required />
                        </div>
                        <div>
                          <label className="label" htmlFor="edit-priority">優先級</label>
                          <select id="edit-priority" className="input" value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}>
                            <option value="low">低</option><option value="normal">中</option><option value="high">高</option><option value="urgent">急</option>
                          </select>
                        </div>
                        <div>
                          <label className="label" htmlFor="edit-status">狀態</label>
                          <select id="edit-status" className="input" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                            <option value="open">待處理</option><option value="in_progress">處理中</option><option value="resolved">已解決</option><option value="closed">已結案</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2 flex gap-2">
                          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "儲存中..." : "儲存"}</button>
                          <button type="button" className="btn-ghost" onClick={() => setEditingId(null)}>取消</button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className="border-b border-[var(--border)]/50">
                    <td className="p-3 text-[var(--text-secondary)]">{propName(r.propertyId)}</td>
                    <td className="p-3">{catText(r.category)}</td>
                    <td className="p-3 font-medium">{r.title}</td>
                    <td className="p-3">{PRIORITY_LABEL[r.priority] ?? r.priority}</td>
                    <td className="p-3">{STATUS_LABEL[r.status] ?? r.status}</td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button className="text-xs text-[var(--accent)] hover:underline mr-3" onClick={() => startEdit(r)}>編輯</button>
                      <button className="text-xs text-[var(--danger)] hover:underline" onClick={() => handleDelete(r.id)}>刪除</button>
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