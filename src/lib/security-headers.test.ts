// AC-008 安全標頭設定測試（E2E 另外驗證實際回應，見 e2e/smoke.spec.ts）
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig, { contentSecurityPolicy, securityHeaders } from "../../next.config";

describe("AC-008 安全標頭設定", () => {
  it("AC-008 包含 hotel-pm 的 6 個安全標頭", () => {
    expect(securityHeaders.map((h) => h.key)).toEqual([
      "Content-Security-Policy",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Strict-Transport-Security",
    ]);
  });

  it("AC-008 標頭套用到所有路徑", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toEqual([{ source: "/:path*", headers: securityHeaders }]);
  });

  it("AC-008 各標頭的值與 hotel-pm 一致", () => {
    const byKey = Object.fromEntries(securityHeaders.map((h) => [h.key, h.value]));
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(byKey["Permissions-Policy"]).toBe("microphone=(), camera=(), geolocation=()");
    expect(byKey["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains; preload");
  });

  it("AC-008 CSP 禁止被嵌入、限制 base-uri 與 form-action", () => {
    const directives = contentSecurityPolicy.split("; ");
    expect(directives).toContain("default-src 'self'");
    expect(directives).toContain("frame-ancestors 'none'");
    expect(directives).toContain("base-uri 'self'");
    expect(directives).toContain("form-action 'self'");
  });

  it("AC-008 非開發模式的 CSP 不含 unsafe-eval", () => {
    expect(contentSecurityPolicy).not.toContain("unsafe-eval");
  });

  it("AC-008 CSP 不擋 Stripe Checkout：結帳是頂層導頁，且沒有 navigate-to 之類會擋導頁的指令", () => {
    expect(contentSecurityPolicy).not.toMatch(/navigate-to/);
    const checkoutPage = readFileSync(
      path.resolve(__dirname, "../app/checkout/page.tsx"),
      "utf8",
    );
    // 前端以 window.location.href 導到 Stripe 回傳的 URL（不是 iframe、不是表單送出）
    expect(checkoutPage).toMatch(/window\.location\.href = data\.url/);
    expect(checkoutPage).not.toMatch(/<iframe/);
  });
});

describe("AC-008 proxy（Next.js 16 的 middleware）", () => {
  const proxySource = readFileSync(path.resolve(__dirname, "../proxy.ts"), "utf8");
  it("AC-008 保護 /dashboard 底下所有路徑", () => {
    expect(proxySource).toMatch(/matcher: \["\/dashboard\/:path\*"\]/);
  });
  it("AC-008 未登入時轉到 /login", () => {
    expect(proxySource).toMatch(/NextResponse\.redirect\(new URL\("\/login"/);
  });
});
