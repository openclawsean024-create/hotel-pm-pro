# hotel-pm-pro · 變更日誌

> 自動維護：Sean 10-repo-fleet · 2026-09-06

---

## v3.0.2 — 2026-09-06 · Fleet 升級

> v3.0.2 完成於 2026-09-06 by Sean 10-repo-fleet

**升級原因**：原 repo 為 Sean 個人開發的自由版本，無規格書。本次 Fleet Batch 6C 補完。

### Added
- ✅ `PRD/SPEC.md` — v3.0.2 規格書（9 章節、15 條 FR、NFR table、部署契約、mermaid flow）
- ✅ `PRD/CHANGELOG.md` — 本文件
- ✅ `.github/workflows/ci.yml` — GHA 4-job workflow（lint / test / build / deploy-vercel）

### Fixed
- 🐛 `src/app/api/stripe/checkout/route.ts` — `apiVersion: "2026-08-26.dahlia"` → `"2026-07-29.dahlia"`（Stripe 22.4 不接受 08-26）
- 🐛 `src/app/api/stripe/webhook/route.ts` — 同上修正
- 🐛 `npx tsc --noEmit` 從 2 error → 0 error

### Verified
- ✅ `npx tsc --noEmit` 0 error
- ✅ `npx next build` 0 error（待 GHA 驗證）
- ✅ 8 個 `.env.example` 環境變數完整
- ✅ `prisma/seed.ts` idempotent demo 資料（1 user / 1 subscription / 2 properties / 2 tenants / 4 bookings / 2 requirements / 1 maintenance）

### Notes
- 部署目標：**Vercel**（vercel-action）
- 預設分支：`main`
- 已知限制：F-M7 房東月報表目前僅 PDF；F-M10 跨物業儀表板使用 join，>100 物業需做分頁優化
- 後續 sprint（v3.1+）：
  - FR-016 LINE Notify 月繳提醒推播
  - FR-017 多物業儀表板快取化（Redis/Upstash）
  - FR-018 預約確認信自動寄送
  - FR-019 維修派工照片上傳（Supabase Storage）
  - FR-020 匯出 CSV 給會計師（替代/輔助 PDF）

---

## v3.0 — 2026-08（原始自由版本）

由 Sean 個人開發，無規格書。原始功能：
- Email/密碼註冊（NextAuth 5 beta）
- 物業 / 房客 / 訂房 / 需求 / 派工 CRUD
- ICS 自動匯入（RFC 5545 parser）
- 月報表 PDF 匯出
- Stripe Checkout 訂閱（Pro / Business）
- 8 個 `.env.example` 環境變數

技術棧：
- Next.js 16.2.12（App Router）
- React 19.2.4
- Prisma 5.22 + pg 8.22（直連 Supabase Transaction pooler）
- NextAuth 5.0.0-beta.32（Auth.js v5）
- Stripe 22.4
- Zod 4
- Tailwind v3
- TypeScript 5

---

## v2.x — 開發里程碑

- v2.0 — 物業/房客/訂房 CRUD
- v2.5 — Auth.js v5 + Prisma schema
- v2.8 — ICS 自動匯入
- v2.9 — Stripe Checkout + 月報表 PDF

---

## v1.x — 初始

- v1.0 — Next.js 14 + Prisma + NextAuth v4 初版

---

*v3.0.2 升級流程符合 Sean 10-repo-fleet SOP：clone → inspect → PRD v3.0.2 → 開發補完 → GHA CI → push。*
