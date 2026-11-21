// AC-008 E2E 冒煙測試：公開頁可載入、未登入的後台與 API 被擋、回應帶 6 個安全標頭。
// 不需要資料庫。
import { expect, test } from "@playwright/test";

const SECURITY_HEADERS: Record<string, RegExp> = {
  "content-security-policy": /default-src 'self'.*frame-ancestors 'none'/,
  "x-content-type-options": /^nosniff$/,
  "x-frame-options": /^DENY$/,
  "referrer-policy": /^strict-origin-when-cross-origin$/,
  "permissions-policy": /microphone=\(\), camera=\(\), geolocation=\(\)/,
  "strict-transport-security": /max-age=63072000; includeSubDomains; preload/,
};

test.describe("AC-008 公開頁可載入", () => {
  test("AC-008 首頁可載入", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    await expect(page.locator("#landing-hero-heading")).toBeVisible();
  });

  test("AC-008 方案頁可載入，價格未被更動", async ({ page }) => {
    const res = await page.goto("/pricing");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "簡單透明的定價" })).toBeVisible();
    await expect(page.getByText("NT$499", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("NT$1,499", { exact: true }).first()).toBeVisible();
  });

  test("AC-008 登入頁可載入", async ({ page }) => {
    const res = await page.goto("/login");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "登入" })).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("button", { name: "登入" })).toBeEnabled();
  });

  test("AC-008 公開註冊仍為關閉：/register 轉到 /login，註冊 API 回 410", async ({ page, request }) => {
    await page.goto("/register");
    await expect(page).toHaveURL(/\/login$/);
    const res = await request.post("/api/auth/register", { data: {} });
    expect(res.status()).toBe(410);
  });
});

test.describe("AC-008 未登入的存取保護", () => {
  for (const path of [
    "/dashboard",
    "/dashboard/properties",
    "/dashboard/tenants",
    "/dashboard/bookings",
    "/dashboard/ics",
    "/dashboard/requirements",
    "/dashboard/maintenance",
    "/dashboard/reports",
  ]) {
    test(`AC-008 未登入造訪 ${path} 轉到 /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { level: 1, name: "登入" })).toBeVisible();
    });
  }

  test("AC-008 proxy 以 HTTP 轉址擋下未登入的 /dashboard（不靠前端）", async ({ request }) => {
    const res = await request.get("/dashboard/reports", { maxRedirects: 0 });
    expect([302, 307]).toContain(res.status());
    expect(res.headers()["location"]).toMatch(/\/login$/);
  });

  for (const api of [
    "/api/properties",
    "/api/tenants",
    "/api/bookings",
    "/api/requirements",
    "/api/maintenance",
    "/api/reports/monthly?month=2026-07",
    "/api/reports/monthly?month=2026-07&format=csv",
    "/api/dashboard/summary",
  ]) {
    test(`AC-008 未登入呼叫 ${api} 回 401`, async ({ request }) => {
      const res = await request.get(api);
      expect(res.status()).toBe(401);
    });
  }

  test("AC-008 未登入不能匯入 ICS、不能建立結帳", async ({ request }) => {
    const ics = await request.post("/api/ics/import", {
      data: { propertyId: "p1", icsUrl: "https://calendar.example.test/fake.ics" },
    });
    expect(ics.status()).toBe(401);
    const checkout = await request.post("/api/stripe/checkout", { data: { plan: "pro" } });
    expect(checkout.status()).toBe(401);
  });

  test("AC-008 沒有簽章的 Stripe webhook 回 400", async ({ request }) => {
    const res = await request.post("/api/stripe/webhook", { data: { type: "checkout.session.completed" } });
    expect(res.status()).toBe(400);
  });
});

test.describe("AC-008 安全標頭", () => {
  for (const path of ["/", "/pricing", "/login", "/api/properties"]) {
    test(`AC-008 ${path} 的回應含 6 個安全標頭`, async ({ request }) => {
      const res = await request.get(path);
      const headers = res.headers();
      for (const [name, pattern] of Object.entries(SECURITY_HEADERS)) {
        expect(headers[name], `缺少標頭 ${name}`).toMatch(pattern);
      }
    });
  }

  test("AC-008 轉址回應也帶安全標頭", async ({ request }) => {
    const res = await request.get("/dashboard", { maxRedirects: 0 });
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  test("AC-008 CSP 不擋首頁與登入頁自己的 script／style（瀏覽器沒有 CSP 違規）", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (msg) => {
      if (/Content Security Policy|Content-Security-Policy/i.test(msg.text())) violations.push(msg.text());
    });
    await page.goto("/");
    await page.goto("/login");
    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");
    expect(violations).toEqual([]);
  });
});
