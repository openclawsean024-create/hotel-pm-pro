# Operations Dashboard — Acceptance Criteria

> Planner (read-only) deliverable, captured by orchestrator. Source of truth: `PRD/SPEC.md` v3.0.2, `PRD/UI-SPEC.md` v1.0, `dashboard.html` (Sean-approved IA/structure reference), existing `src/app/dashboard/page.tsx`, `src/components/AppNav.tsx`, `prisma/schema.prisma`. Implementation Owner: Primary Worker.

## A. Information Architecture

- A1: Replace `src/app/dashboard/page.tsx` with the new Operations Dashboard; all eight sibling routes (`properties`, `tenants`, `bookings`, `requirements`, `maintenance`, `ics`, `reports`) must keep their existing file paths and continue to be reachable.
- A2: Extend `src/components/AppNav.tsx` with two new entries — 需求單 `/dashboard/requirements` and 派工單 `/dashboard/maintenance` — and group items under four headings: 營運 (總覽), 管理 (訂房 / 房客 / 物業 / 維修與待辦), 財務 (月報表), 自動化 (ICS 同步). Existing item hrefs/active logic must keep working.
- A3: The new dashboard must not introduce new page routes beyond `/dashboard`. New server APIs go under `/api/dashboard/*` only.
- A4: Preserve the existing top header (logo + user email + tier badge + 升級 CTA + 登出) above the dashboard content; the dashboard may add the property switcher inside it.

## B. Visual System (additive to existing `globals.css` — DO NOT replace indigo / gold tokens)

- B1: Reuse existing CSS variables `--bg-primary` / `--bg-secondary` / `--bg-tertiary` / `--border` / `--accent` (indigo) / `--gold` / `--text-*` / `--radius-*` for surface and typography. Keep dark-mode canvas.
- B2: Add (do not replace) status palette tokens only: `--status-ready` (success mint, maps to `--success`), `--status-pending` (amber, hex ≈ `#c88420`), `--status-blocked` (coral, hex ≈ `#cf5f56`), `--status-info` (blue, hex ≈ `#3977c8`), and their `-soft` background variants.
- B3: Status must be conveyed by text + color + icon, never by color alone (UI-SPEC §2 狀態可掃讀).
- B4: Numeric values (KPI, currency, occupancy) must use `font-variant-numeric: tabular-nums` for column alignment.

## C. Components (each maps to existing prototype section)

- C1. KPI strip — exactly 4 cards in this order: 今日入住 (count of `Booking` with `checkIn` between today 00:00–23:59), 今日退房 (same for `checkOut`), 本月營收 (sum `Booking.totalPrice` in current month), 待處理案件 (count `Requirement` + `Maintenance` with status ≠ resolved/completed). Each card is a link to the corresponding filtered list route.
- C2. Room status grid — uses `Property.roomType` as the visual proxy (no `Room` model exists per PRD §8 follow-up). Render one tile per `Property` in the active scope. State derivation: 空房 (no active booking), 已入住 (active booking covers today), 今日退房 (booking with `checkOut` = today), 待清潔 (booking with `checkOut` = yesterday and no new booking today), 維修中 (active `Maintenance` for property). Every tile shows property id + room type + state label + state icon.
- C3. Today timeline — ordered ascending by time. Aggregates today's check-ins, check-outs, cleaning markers (derived from prior-day check-out without follow-up booking), and maintenance events (active `Maintenance.startDate` ≤ today and (no `completedAt` or `completedAt` > today)). Each item: time + event type + property + secondary meta + status pill.
- C4. Workbench table — single combined table of top 4–5 open items: `Requirement` where `status ∈ {open, in_progress}` ∪ `Maintenance` where `status ∈ {pending, in_progress}`, sorted by priority then `createdAt` desc. Columns: 案件 / 物業 / 類型 / 優先級 / 截止時間 / 狀態. Each row is a link to its detail route. Add a 「查看全部」 footer link to `/dashboard/requirements` and `/dashboard/maintenance`.
- C5. Revenue chart + property performance — monthly revenue trend (last 6 months bar chart, server-side data; current month highlighted) and per-property performance rows showing each `Property` with MTD revenue and occupancy proxy. Footer CTA → `/dashboard/reports` (which uses `/api/reports/monthly`).
- C6. Quick actions — exactly 4 verbs from UI-SPEC §5: 新增訂房 → `/dashboard/bookings`, 建立維修 → `/dashboard/maintenance`, ICS 同步 → `/dashboard/ics`, 匯出月報 → `/dashboard/reports`. Each is an `<a>`/`<Link>` to the real route — no fake modal that pretends to write to backend.
- C7. Property switcher — sits in the sidebar (header on collapsed mobile). Lists all `Property` plus a 「全部物業」 option; selection is stored client-side (URL query `?propertyId=`), drives scope of KPI / grid / timeline / workbench.
- C8. Mobile bottom-nav — at viewport `<780px`, render a fixed bottom tab bar with exactly 4 tabs (總覽 / 訂房 / 待辦 / 月報). Map 待辦 → `/dashboard/requirements`. Tabs use semantic `<nav>` with `aria-label`.

## D. Functional acceptance

- D1: Session guard preserved — server pages still rely on NextAuth middleware; client `useSession()` redirects to `/login` when unauthenticated (existing behavior in `page.tsx`).
- D2: New server endpoint `GET /api/dashboard/summary` (single source of truth for the new dashboard) — session-auth-protected (reuse `getServerSession` / auth options), accepts `?propertyId=` and `?month=YYYY-MM` (optional), returns JSON: `{ kpi, occupancy, rooms[], timeline[], workbench[], revenueSeries[], propertyPerformance[] }`. All numerics derived from Prisma (`booking`, `requirement`, `maintenance`, `property`) — no raw `fetch` of internal CRUD endpoints from the client.
- D3: Client fetches summary via `/api/dashboard/summary`, not by re-querying `/api/properties`, `/api/bookings`, `/api/requirements`, `/api/maintenance`, `/api/reports/monthly` from the browser.
- D4: Loading state shows skeleton blocks (not the previous `載入中...` text-only screen); error state shows a retry button bound to refetch; empty state shows a single 「新增第一個物業」 CTA when `properties.length === 0`.
- D5: Property switcher selection persists across reload via URL query; deep-linkable.
- D6: All existing API behavior under `/api/properties`, `/api/bookings`, `/api/requirements`, `/api/maintenance`, `/api/reports/monthly`, `/api/ics/import` is preserved verbatim — no edits to those files.
- D7: New endpoint must validate query params with Zod and return `400` on invalid input, `401` on missing session, `200` with shape above otherwise.

## E. Accessibility (WCAG 2.1 AA per SPEC §4)

- E1: One `<main>` landmark per dashboard; one `<aside>` for sidebar; one `<nav aria-label="主導覽">` and one `<nav aria-label="行動導覽">` on mobile.
- E2: All `<button>`/`<a>` with icon-only content must carry `aria-label`; status pills must include text (not color-only).
- E3: Visible focus ring on every interactive element (`:focus-visible` ≥ 2px, contrast ratio ≥ 3:1 against adjacent surface).
- E4: Color contrast ≥ 4.5:1 for body text and ≥ 3:1 for large text / icon glyphs against background.
- E5: All form inputs (filter row, property switcher) have associated `<label>` or `aria-label`; tables use `<th scope="col">`.
- E6: Timeline / KPI numbers are announced as localized strings (千分位 + NT$ prefix); currency uses `aria-label="本月營收，新台幣 12 萬 3,400 元"` if visual text is purely numeric.
- E7: Bottom-nav on `<780px` keeps ≥ 44×44px tap targets and `aria-current="page"` on the active tab.

## F. Out of scope (must NOT be touched)

- F1: `prisma/schema.prisma`, `src/lib/auth.ts`, `src/lib/prisma.ts`, `src/lib/pg-client.ts`, NextAuth/Stripe secrets, env vars, `package.json` runtime deps. **No Room model.**
- F2: All existing `/api/**` route handlers, including `/api/properties[/...]`, `/api/bookings[/...]`, `/api/tenants[/...]`, `/api/requirements[/...]`, `/api/maintenance[/...]`, `/api/ics/import`, `/api/reports/monthly`, `/api/stripe/**`, `/api/contact`, `/api/auth/**`.
- F3: Other `/dashboard/*` page files (properties / tenants / bookings / requirements / maintenance / ics / reports) — only `/dashboard/page.tsx` is replaced; siblings stay byte-compatible.
- F4: Marketing pages (`/`, `/pricing`, `/login`, `/register`, `/contact`, `/faq`, `/terms`, `/privacy`, `/checkout`), NextAuth config, middleware config, Tailwind config.
- F5: No new modal that pretends to POST to backend; no optimistic-write fake flow.

## G. Verification commands (Final reviewer will run)

- G1: `npx tsc --noEmit` — exit 0.
- G2: `npx next build` — exit 0.
- G3: `curl -i http://localhost:3000/dashboard` after `npm run dev` returns 200 with one `<main>` landmark; `curl -i http://localhost:3000/api/dashboard/summary` (with valid session cookie) returns 200 + the JSON shape from D2; unauthenticated call returns 401.
- G4: HTML semantic check on `/dashboard`: exactly one `<main>`, one `<aside aria-label="主導覽">`, presence of `aria-label` on every icon-only control, focus ring visible via `:focus-visible` rule in DevTools.
- G5: Visual diff: at viewport `≥1180px` desktop layout matches prototype section ordering (header → alert strip → KPI → room grid + today timeline → workbench → revenue + property performance → quick actions); at `<780px` bottom-nav renders with 4 tabs and no horizontal page-level overflow.
- G6: Nav regression — clicking 物業 / 房客 / 訂房 / 需求單 / 派工單 / 月報表 / ICS 同步 from `AppNav` navigates correctly and `aria-current` highlights the active route; `requirements` and `maintenance` are reachable for the first time.

## H. Open follow-ups (logged, not blockers)

- H1: Room model — UI-SPEC §8.4 explicitly notes the lack of a `Room` model; current AC uses `Property` as visual proxy. A real `Room` table is a separate spec task.
- H2: Server-side summary endpoint is the only new API; if `?month=` is omitted it defaults to current month; future cache layer is out of scope here.