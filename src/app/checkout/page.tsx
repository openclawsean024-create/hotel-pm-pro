// app/checkout/page.tsx
"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const plan = searchParams.get("plan") ?? "pro";
  const planName = plan === "business" ? "Business" : "Pro";
  const planPrice = plan === "business" ? "NT$1,499" : "NT$499";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/login?redirect=/checkout?plan=${plan}`);
    }
  }, [status, plan, router]);

  async function handleCheckout() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "建立付款頁失敗");
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setError("付款失敗，請稍後重試");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">載入中...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-1">確認訂閱</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">將由 Stripe 處理付款（測試模式）</p>

        <div className="border border-[var(--border)] rounded-md p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold">{planName} 方案</span>
            <span className="text-xl font-bold">{planPrice}</span>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">每月自動續訂，隨時可取消</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}

        <button onClick={handleCheckout} className="btn-primary w-full justify-center" disabled={loading}>
          {loading ? "處理中..." : "前往 Stripe 付款"}
        </button>

        <p className="mt-4 text-xs text-center text-[var(--text-muted)]">
          點擊按鈕同意 <a href="/terms" className="underline">服務條款</a>
        </p>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return <Suspense fallback={<div>載入中...</div>}><CheckoutContent /></Suspense>;
}
