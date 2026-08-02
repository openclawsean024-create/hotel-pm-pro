// app/contact/page.tsx
"use client";
import { useState } from "react";
import Link from "next/link";

const SUBJECTS = [
  "產品諮詢",
  "技術問題",
  "帳號問題",
  "付費 / 退款",
  "合作提案",
  "其他",
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: SUBJECTS[0], message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "送出失敗");
        return;
      }
      setSubmitted(true);
    } catch (err) {
      setError("送出失敗，請稍後重試");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card max-w-md w-full p-8 text-center">
          <div className="text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold mb-2">訊息已送出</h1>
          <p className="text-[var(--text-secondary)] mb-6">我們會在 1-2 個工作天內回覆</p>
          <Link href="/" className="btn-secondary">回首頁</Link>
        </div>
      </div>
    );
  }

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

      <main className="container-page py-16 max-w-2xl">
        <h1 className="text-3xl font-bold mb-2">聯絡我們</h1>
        <p className="text-[var(--text-secondary)] mb-8">有任何問題？我們會在 1-2 個工作天內回覆</p>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label" htmlFor="name">姓名</label>
            <input id="name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label className="label" htmlFor="subject">問題類型</label>
            <select id="subject" className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="message">訊息</label>
            <textarea id="message" className="input min-h-[150px]" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
          </div>
          <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
            {loading ? "送出中..." : "送出訊息"}
          </button>
        </form>
      </main>
    </div>
  );
}
