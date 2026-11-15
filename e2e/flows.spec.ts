// AC-008 主要流程 E2E（登入後的後台畫面）。
//
// 不需要資料庫：
//   - 登入狀態：用 E2E 專用的假 AUTH_SECRET 簽一個 session cookie（Auth.js 的 JWT session 不查資料庫）。
//   - 資料：以 page.route 攔截瀏覽器發出的 /api/** 請求並回傳假資料。
// 這裡驗證「頁面拿到 API 回應後的行為」；API 本身的規則由 Vitest 的 route handler 測試負責。
import { expect, test, type Page, type Route } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { E2E_AUTH_SECRET } from "../playwright.config";

const SESSION_COOKIE = "authjs.session-token";
const PROPERTIES = [
  { id: "p1", name: "測試物業A", address: "台北市測試路 XX 號", roomType: "整層", monthlyRent: 30000, ownerShare: 70 },
  { id: "p2", name: "測試物業B", address: "台中市測試路 XX 號", roomType: "套房", monthlyRent: 0, ownerShare: 80 },
];

/** 台北時區的今天加減天數，回傳 YYYY-MM-DD。 */
function taipeiDate(offsetDays: number): string {
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  now.setUTCDate(now.getUTCDate() + offsetDays);
  return now.toISOString().slice(0, 10);
}

async function signIn(page: Page) {
  const value = await encode({
    token: { sub: "e2e-user-1", id: "e2e-user-1", email: "demo@hotel-pm.test", name: "測試業者A" },
    secret: E2E_AUTH_SECRET,
    salt: SESSION_COOKIE,
  });
  await page.context().addCookies([
    { name: SESSION_COOKIE, value, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function mockProperties(page: Page) {
  await page.route("**/api/properties", (route) => json(route, { properties: PROPERTIES }));
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test.describe("AC-008 登入後的主要流程", () => {
  test("AC-008 有效的 session 可以進入後台，不會被轉回登入頁", async ({ page }) => {
    await mockProperties(page);
    await page.route("**/api/tenants", (route) => json(route, { tenants: [] }));
    await page.goto("/dashboard/tenants");
    await expect(page).toHaveURL(/\/dashboard\/tenants$/);
    await expect(page.getByRole("heading", { level: 1, name: "房客管理" })).toBeVisible();
  });

  test("AC-008 竄改過的 session cookie 無效，仍被轉到 /login", async ({ page }) => {
    await page.context().clearCookies();
    await page.context().addCookies([
      { name: SESSION_COOKIE, value: "not-a-valid-token", domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/dashboard/reports");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("AC-003 月報頁顯示拆帳結果，並可下載 CSV", async ({ page }) => {
    const csv =
      "﻿月份,物業,月租金,訂房筆數,訂房收入,總收入,房東分潤比例(%),房東分潤,業者分潤\n2026-07,合計,30000,1,6000,36000,,25200,10800";
    await page.route("**/api/reports/monthly?*", (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("format") === "csv") {
        return route.fulfill({
          status: 200,
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": `attachment; filename="monthly-report-${url.searchParams.get("month")}.csv"`,
          },
          body: csv,
        });
      }
      return json(route, {
        month: url.searchParams.get("month"),
        properties: [
          {
            propertyId: "p1",
            propertyName: "測試物業A",
            monthlyRent: 30000,
            ownerSharePercent: 70,
            bookingRevenue: 6000,
            bookingCount: 1,
            totalIncome: 36000,
            ownerShareAmount: 25200,
            operatorShare: 10800,
            bookings: [
              { id: "b1", guestName: "測試旅客A", checkIn: "2026-07-10", checkOut: "2026-07-12", channel: "manual", totalPrice: 6000 },
            ],
          },
        ],
        summary: { totalRevenue: 36000, totalOwnerShare: 25200, totalOperatorShare: 10800, propertyCount: 1 },
      });
    });

    await page.goto("/dashboard/reports");
    await expect(page.getByRole("heading", { level: 1, name: "月報表 + 房東分潤" })).toBeVisible();
    await page.getByLabel("月份").fill("2026-07");
    await expect(page.getByText("NT$ 36,000").first()).toBeVisible();
    await expect(page.getByText("NT$ 25,200").first()).toBeVisible();
    await expect(page.getByText("NT$ 10,800").first()).toBeVisible();

    const link = page.getByTestId("download-csv");
    await expect(link).toHaveAttribute("href", "/api/reports/monthly?month=2026-07&format=csv");
    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    expect(download.suggestedFilename()).toBe("monthly-report-2026-07.csv");
  });

  test("AC-004 房客頁顯示合約 30 天內到期與已逾期的提醒", async ({ page }) => {
    await mockProperties(page);
    const tenant = (id: string, name: string, endDate: string | null) => ({
      id,
      name,
      phone: "0900-000-001",
      email: null,
      propertyId: "p1",
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: endDate ? `${endDate}T00:00:00.000Z` : null,
      monthlyRent: 30000,
      deposit: 60000,
      status: "active",
    });
    await page.route("**/api/tenants", (route) =>
      json(route, {
        tenants: [
          tenant("t1", "測試房客A", taipeiDate(10)),
          tenant("t2", "測試房客B", taipeiDate(-5)),
          tenant("t3", "測試房客C", taipeiDate(90)),
          tenant("t4", "測試房客D", null),
        ],
      }),
    );

    await page.goto("/dashboard/tenants");
    const summary = page.getByTestId("contract-alert-summary");
    await expect(summary).toContainText("1 位房客合約已逾期");
    await expect(summary).toContainText("1 位房客合約將在 30 天內到期");

    await expect(page.getByTestId("contract-alert")).toHaveCount(2);
    await expect(page.getByRole("row", { name: /測試房客A/ }).getByTestId("contract-alert")).toHaveText("合約將於 10 天內到期");
    const overdue = page.getByRole("row", { name: /測試房客B/ }).getByTestId("contract-alert");
    await expect(overdue).toHaveText("合約已逾期 5 天");
    await expect(overdue).toHaveAttribute("data-severity", "danger");
    await expect(page.getByRole("row", { name: /測試房客C/ }).getByTestId("contract-alert")).toHaveCount(0);
    await expect(page.getByRole("row", { name: /測試房客D/ }).getByTestId("contract-alert")).toHaveCount(0);
  });

  test("AC-005 訂房重疊時頁面顯示 API 回傳的 409 訊息", async ({ page }) => {
    await mockProperties(page);
    let posted: Record<string, unknown> | null = null;
    await page.route("**/api/bookings", (route) => {
      if (route.request().method() === "POST") {
        posted = route.request().postDataJSON();
        return json(
          route,
          { error: "此物業在這段日期已有訂房，無法重複訂房", conflicts: [{ id: "b1", checkIn: "2027-01-10", checkOut: "2027-01-12" }] },
          409,
        );
      }
      return json(route, { bookings: [] });
    });

    await page.goto("/dashboard/bookings");
    await page.getByRole("button", { name: "+ 新增訂房" }).click();
    const form = page.locator("form");
    await form.locator('input:not([type="date"]):not([type="number"])').first().fill("測試旅客B");
    await form.locator('input[type="date"]').nth(0).fill("2027-01-11");
    await form.locator('input[type="date"]').nth(1).fill("2027-01-13");
    await form.locator('input[type="number"]').fill("6000");
    await form.getByRole("button", { name: "建立訂房" }).click();

    await expect(page.getByText("此物業在這段日期已有訂房，無法重複訂房")).toBeVisible();
    expect(posted).toMatchObject({
      propertyId: "p1",
      guestName: "測試旅客B",
      checkIn: "2027-01-11",
      checkOut: "2027-01-13",
      totalPrice: 6000,
    });
    await expect(form).toBeVisible();
  });

  test("AC-007 ICS 匯入後顯示建立的訂房數與重疊警示", async ({ page }) => {
    await mockProperties(page);
    let posted: Record<string, unknown> | null = null;
    await page.route("**/api/ics/import", (route) => {
      posted = route.request().postDataJSON();
      return json(route, {
        imported: 3,
        skipped: 0,
        bookingsCreated: 2,
        bookingsExisting: 0,
        overlapped: 1,
        events: [
          { uid: "fake-airbnb-0001@fixture.hotel-pm.test", summary: "Reserved", checkIn: "2027-01-02T00:00:00.000Z", checkOut: "2027-01-05T00:00:00.000Z", booking: "overlapped" },
          { uid: "fake-airbnb-0002@fixture.hotel-pm.test", summary: "Airbnb (Not available)", checkIn: "2027-01-10T00:00:00.000Z", checkOut: "2027-01-12T00:00:00.000Z", booking: "created" },
          { uid: "fake-airbnb-0003@fixture.hotel-pm.test", summary: "Reserved", checkIn: "2027-01-18T00:00:00.000Z", checkOut: "2027-01-20T00:00:00.000Z", booking: "created" },
        ],
      });
    });

    await page.goto("/dashboard/ics");
    await page.locator('input[type="url"]').fill("https://calendar.example.test/fake-airbnb.ics");
    await page.getByRole("button", { name: "匯入" }).click();

    await expect(page.getByTestId("ics-result")).toContainText("建立 2 筆訂房");
    await expect(page.getByTestId("ics-overlap-warning")).toContainText("1 筆事件與這個物業既有的訂房日期重疊");
    await expect(page.locator('td[data-booking="overlapped"]')).toHaveText("與既有訂房重疊，未建立");
    await expect(page.locator('td[data-booking="created"]')).toHaveCount(2);
    expect(posted).toEqual({ propertyId: "p1", icsUrl: "https://calendar.example.test/fake-airbnb.ics", source: "airbnb" });
  });

  test("AC-007 ICS 匯入被 SSRF 防護擋下時顯示錯誤訊息", async ({ page }) => {
    await mockProperties(page);
    await page.route("**/api/ics/import", (route) => json(route, { error: "ICS 不允許連到內部或保留的 IP 位址" }, 400));
    await page.goto("/dashboard/ics");
    await page.locator('input[type="url"]').fill("https://169.254.169.254/latest/meta-data/");
    await page.getByRole("button", { name: "匯入" }).click();
    await expect(page.getByText("ICS 不允許連到內部或保留的 IP 位址")).toBeVisible();
    await expect(page.getByTestId("ics-result")).toHaveCount(0);
  });

  test("AC-009 需求單可以編輯：修改標題與狀態後送出 PATCH 並更新列表", async ({ page }) => {
    await mockProperties(page);
    let current = {
      id: "req-1",
      userId: "e2e-user-1",
      propertyId: "p1",
      category: "repair",
      title: "測試需求A",
      description: "測試描述",
      priority: "normal",
      status: "open",
      createdAt: "2026-11-01T00:00:00.000Z",
    };
    let patched: Record<string, unknown> | null = null;
    let patchMethod = "";
    await page.route("**/api/requirements", (route) => json(route, { requirements: [current] }));
    await page.route("**/api/requirements/req-1", (route) => {
      patchMethod = route.request().method();
      patched = route.request().postDataJSON();
      current = { ...current, ...(patched as Partial<typeof current>) };
      return json(route, current);
    });

    await page.goto("/dashboard/requirements");
    const row = page.getByRole("row", { name: /測試需求A/ });
    await expect(row).toContainText("待處理");
    await row.getByRole("button", { name: "編輯" }).click();

    const editRow = page.getByTestId("requirement-edit-row");
    await expect(editRow.locator("#edit-title")).toHaveValue("測試需求A");
    await expect(editRow.locator("#edit-description")).toHaveValue("測試描述");
    await editRow.locator("#edit-title").fill("測試需求A（已修改）");
    await editRow.locator("#edit-priority").selectOption("urgent");
    await editRow.locator("#edit-status").selectOption("resolved");
    await editRow.getByRole("button", { name: "儲存" }).click();

    await expect(page.getByTestId("requirement-edit-row")).toHaveCount(0);
    const updated = page.getByRole("row", { name: /測試需求A（已修改）/ });
    await expect(updated).toContainText("已解決");
    await expect(updated).toContainText("急");
    expect(patchMethod).toBe("PATCH");
    expect(patched).toEqual({ title: "測試需求A（已修改）", description: "測試描述", priority: "urgent", status: "resolved" });
  });

  test("AC-009 總覽頁：預載失敗時明確提示（不是假裝沒有物業），並顯示合約提醒", async ({ page }) => {
    // E2E 環境沒有資料庫，伺服器端預載一定失敗；summary API 以假資料回應。
    await page.route("**/api/dashboard/summary*", (route) =>
      json(route, {
        properties: PROPERTIES.map(({ id, name, roomType }) => ({ id, name, roomType })),
        kpi: { checkInsToday: 1, checkOutsToday: 1, revenueMonth: 36000, openCases: 2 },
        occupancy: { rate: 50, available: 0, occupied: 2, cleaning: 0, maintenance: 0 },
        rooms: [
          { id: "p1", name: "測試物業A", roomType: "整層", state: "occupied", propertyId: "p1" },
          { id: "p2", name: "測試物業B", roomType: "套房", state: "checkout_today", propertyId: "p2" },
        ],
        timeline: [
          { time: "11:00", type: "checkout", propertyId: "p2", meta: "測試旅客B · 測試物業B", pill: { label: "退房", tone: "info" } },
        ],
        workbench: [],
        revenueSeries: [{ month: "2026-11", total: 36000 }],
        propertyPerformance: [
          { id: "p1", name: "測試物業A", mtdRevenue: 36000, occupancy: 50 },
          { id: "p2", name: "測試物業B", mtdRevenue: 0, occupancy: 10 },
        ],
        contractAlerts: [
          { tenantId: "t1", tenantName: "測試房客A", propertyId: "p1", propertyName: "測試物業A", endDate: "2026-11-30", message: "合約將於 14 天內到期", severity: "warning" },
          { tenantId: "t2", tenantName: "測試房客B", propertyId: "p2", propertyName: "測試物業B", endDate: "2026-11-01", message: "合約已逾期 15 天", severity: "danger" },
        ],
      }),
    );

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    // 串流渲染可能留下隱藏的節點；使用者看得到的總覽只能有一個。
    await expect(page.locator('[data-testid="dashboard-shell"]:visible')).toHaveCount(1);
    const visibleError = page.locator('[data-testid="preload-error"]:visible');
    await expect(visibleError).toHaveCount(1);
    await expect(visibleError).toContainText("物業資料載入失敗");
    // 預載失敗時不能顯示「還沒有物業」的空狀態
    await expect(page.locator(".ops-empty:visible")).toHaveCount(0);

    const alerts = page.locator('[data-testid="contract-alerts"]:visible');
    await expect(alerts).toContainText("1 份已逾期");
    await expect(alerts).toContainText("1 份 30 天內到期");
    await expect(alerts.first().locator('li[data-severity="danger"]')).toContainText("測試房客B");
    await expect(alerts.first().locator('li[data-severity="warning"]')).toContainText("合約將於 14 天內到期");
    await expect(page.getByText("測試旅客B · 測試物業B").first()).toBeVisible();
  });
});
