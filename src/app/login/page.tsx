// app/login/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        setError("登入失敗：email 或密碼錯誤");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError("登入失敗，請稍後重試");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-1">登入</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">歡迎回到民宿管家</p>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="[email protected]"
              aria-label="Email 地址"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">密碼</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 個字元"
              aria-label="密碼"
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
            {loading ? "登入中..." : "登入"}
          </button>
        </form>

        <p className="mt-6 text-sm text-center text-[var(--text-secondary)]">
          還沒有帳號？<Link href="/register" className="text-[var(--accent)] hover:underline">免費註冊</Link>
        </p>
        <p className="mt-2 text-sm text-center">
          <Link href="/" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">← 回首頁</Link>
        </p>
      </div>
    </div>
  );
}
