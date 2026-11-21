// ESLint flat config（AC-001）。
// Next.js 16 已移除 `next lint`，改由 ESLint CLI 直接執行（見 node_modules/next/dist/docs 的 eslint 章節）。
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // 既有後台頁面在 effect 內呼叫「抓資料後 setState」的函式（fetch-on-mount）。
      // 這條 React Compiler 規則要求整個資料載入方式重寫；這些頁面目前沒有測試覆蓋，
      // 為避免在 M1 引入未驗證的行為變更，先關閉並記錄於 STATUS.md（M2 重構資料載入時再開）。
      "react-hooks/set-state-in-effect": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
