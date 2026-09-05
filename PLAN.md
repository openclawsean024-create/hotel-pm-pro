# hotel-pm-pro 修補計畫

> 替代無法執行的 `mavis team plan run`：用 `task` tool 達成同樣的
> preflight → 3 條平行 → final-build → verifier 隊形。
> 工作目錄：`/Users/sean/.minimax-agent/projects/hotel-pm-pro`
> GitHub：`openclawsean024-create/hotel-pm-pro`（worker 沒 push 權限，產出都在 local）

## 範圍（Sean 拍板）
- **修補 MVP 缺口**（推薦選項 A）
- **只跑 build / typecheck / lint**（不接 DB、不模擬登入、不串 Stripe）

## 已盤點的 MVP 缺口
1. `/dashboard/properties` 頁面**不存在**，但 `AppNav` 已連過去 → 點下去 404
2. `prisma/seed.ts` 是空的 `// seed`
3. F-M9「ICS 自動匯入」只有 `IcsEvent` schema、沒有 API 與 UI
4. `requirements` 與 `maintenance` 頁面有 UI bug：`<label>` 沒 `className="label"`、`<select>` 沒 `className="input"`
5. `README.md` 是 default Next.js 內容
6. 沒 `.env.example`
7. 從未跑過 `npm install` / `tsc` / `build` — baseline 未知

## 技術風險（AGENTS.md 警告）
- Next.js 16.2.12 / React 19.2.4（訓練後版本）
- NextAuth 5.0.0-beta.32（post-training beta）
- Zod 4.4.3（v3 → v4 breaking change）
- Stripe 22.4.0 + `apiVersion: "2026-07-29.dahlia"`（訓練後）
- bcryptjs 3.0.3（從 v2 跳上來）
→ 所有 worker 必須先 `cd && npm install`、再 `ls node_modules/next/dist/docs/` 對齊本地文件，不要靠記憶。

## 隊形（5 個 task）

| # | task | 角色 | 檔案所有權 |
|---|---|---|---|
| 0 | preflight：install + typecheck + build baseline | general | docs/preflight.md（唯讀報告） |
| 1a | /dashboard/properties 頁面 | coder | src/app/dashboard/properties/page.tsx + docs/task-properties-page.md |
| 1b | F-M9 ICS 匯入（API + UI + AppNav） | coder | src/lib/ics-parser.ts + src/app/api/ics/import/route.ts + src/app/dashboard/ics/page.tsx + src/components/AppNav.tsx（加 entry）+ docs/task-ics-import.md |
| 1c | seed + .env.example + README | coder | prisma/seed.ts + .env.example + README.md + package.json（加 prisma.seed） + docs/task-seed-readme.md |
| 2 | final build | coder | docs/final-build.md（不動 source） |
| 3 | final verifier | verifier | docs/final-verdict.md（唯讀） |

## 平行與依賴
- 0 → 1a, 1b, 1c 都 depends on
- 1a, 1b, 1c 互不依賴，平行（1a 只寫 properties/，1b 寫 ics/* + AppNav，1c 寫 seed/README/.env/package.json）
- 2 depends on 1a, 1b, 1c
- 3 depends on 2

## 收斂條件
- 最終 `npx tsc --noEmit` 0 error
- 最終 `next build` 0 error
- AppNav 列的每個 `/dashboard/*` 都找得到 page.tsx
- seed.ts 可被 `tsx` 編譯
- README 繁中、有 setup / env / 部署
- 沒有 worker 偷加 Prisma 用法（lib/prisma.ts 既有不算）

## 不在這次範圍
- Vercel deploy / Supabase / Stripe live
- E2E 測試、Vitest
- 修復 `requirements` / `maintenance` 頁面 UI bug（可列為 follow-up）
- 開新 branch、push GitHub
- 業務邏輯重構

## 報告檔
- `docs/preflight.md` — baseline 現況
- `docs/task-properties-page.md` — 1a 變更
- `docs/task-ics-import.md` — 1b 變更
- `docs/task-seed-readme.md` — 1c 變更
- `docs/final-build.md` — 全套 build 結果
- `docs/final-verdict.md` — independent PASS/FAIL
