import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// 搬自 hotel-pm 的 vitest.config.ts（合併清單 #1）。
// 只跑 src/ 下的單元與 route handler 測試；Playwright E2E 在 e2e/，由 `npm run test:e2e` 執行。
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    // 測試一律使用假環境變數，不讀 .env*，不連真實資料庫或 Stripe。
    env: {
      TZ: "UTC",
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://dummy:dummy@127.0.0.1:5432/dummy",
      AUTH_SECRET: "dummy-auth-secret-for-tests-only-32chars",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      STRIPE_SECRET_KEY: "sk_test_dummy_placeholder",
      STRIPE_WEBHOOK_SECRET: "whsec_dummy_placeholder",
      STRIPE_PRICE_PRO: "price_dummy_pro",
      STRIPE_PRICE_BUSINESS: "price_dummy_business",
    },
  },
  resolve: {
    alias: { "@": path.resolve(rootDir, "./src") },
  },
});
