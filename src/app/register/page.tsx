// app/register/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!agreed) {
      setError("請同意服務條款與隱私權");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "註冊失敗");
        return;
      }

      // 自動登入
      await signIn("credentials", { email: form.email, password: form.password, redirect: false });
      router.push("/dashboard");
    } catch (err) {
      setError("註冊失敗，請稍後重試");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-1">建立帳號</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">14 天免費試用，不需信用卡</p>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="name">姓名</label>
            <input
              id="name"
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              maxLength={50}
            />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">密碼</label>
            <input
              id="password"
              type="password"
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">至少 6 個字元</p>
          </div>
          <label className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              我同意 <Link href="/terms" className="text-[var(--accent)] hover:underline">服務條款</Link> 與{" "}
              <Link href="/privacy" className="text-[var(--accent)] hover:underline">隱私權</Link>
            </span>
          </label>
          <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
            {loading ? "建立帳號中..." : "免費建立帳號"}
          </button>
        </form>

        <p className="mt-6 text-sm text-center text-[var(--text-secondary)]">
          已有帳號？<Link href="/login" className="text-[var(--accent)] hover:underline">登入</Link>
        </p>
        <p className="mt-2 text-sm text-center">
          <Link href="/" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">← 回首頁</Link>
        </p>
      </div>
    </div>
  );
}
