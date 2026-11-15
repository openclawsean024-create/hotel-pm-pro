import type { PlaywrightTestConfig } from "@playwright/test";

// 搬自 hotel-pm 的 playwright.config.ts（合併清單 #1），改用獨立 port 與假環境變數。
// E2E 不需要真實資料庫：DATABASE_URL 指向不存在的本機位址，測試只涵蓋不查資料庫的流程，
// 需要資料的畫面以 page.route 攔截 API 回應（見 e2e/flows.spec.ts）。
const PORT = Number(process.env.E2E_PORT ?? 3210);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export const E2E_AUTH_SECRET = "dummy-auth-secret-for-e2e-only-32chars";

const config: PlaywrightTestConfig = {
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT} -H 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      DATABASE_URL: "postgresql://dummy:dummy@127.0.0.1:5432/dummy",
      AUTH_SECRET: E2E_AUTH_SECRET,
      NEXTAUTH_SECRET: E2E_AUTH_SECRET,
      AUTH_URL: BASE_URL,
      NEXT_PUBLIC_APP_URL: BASE_URL,
      STRIPE_SECRET_KEY: "sk_test_dummy_placeholder",
      STRIPE_WEBHOOK_SECRET: "whsec_dummy_placeholder",
      STRIPE_PRICE_PRO: "price_dummy_pro",
      STRIPE_PRICE_BUSINESS: "price_dummy_business",
    },
  },
};

export default config;
