// AC-010 資料衛生與未定事項的防護測試
//   - repo 內的電話一律是 0900-000-xxx 這類明顯的假號
//   - 不得出現像真的 Stripe 金鑰或 webhook secret
//   - Business 方案價格與公開註冊尚未決定：價格維持現狀、註冊維持關閉
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function trackedAndNewFiles(): string[] {
  // 已追蹤 + 尚未追蹤但未被 .gitignore 排除的檔案
  const out = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
  });
  return out
    .split("\n")
    .filter(Boolean)
    .filter((f) => !f.startsWith("node_modules/") && f !== "package-lock.json")
    .filter((f) => /\.(ts|tsx|mts|mjs|js|json|md|ics|html|css|yml|yaml|prisma|example)$/.test(f));
}

const files = trackedAndNewFiles();
const read = (f: string) => {
  try {
    return readFileSync(path.join(root, f), "utf8");
  } catch {
    return ""; // 已從工作目錄刪除但尚未 commit 的檔案
  }
};

describe("AC-010 資料衛生", () => {
  it("AC-010 掃描範圍涵蓋 seed、測試、fixture 與 E2E", () => {
    expect(files).toContain("prisma/seed.ts");
    expect(files.some((f) => f.startsWith("tests/fixtures/"))).toBe(true);
    expect(files.some((f) => f.startsWith("e2e/"))).toBe(true);
    expect(files.length).toBeGreaterThan(50);
  });

  it("AC-010 所有手機號碼都是 0900-000-xxx 這類明顯的假號", () => {
    const offenders: string[] = [];
    // 台灣手機格式：09 開頭共 10 碼，中間可有 - 或空白
    const mobile = /(?<![\d.])09\d{2}[- ]?\d{3}[- ]?\d{3}(?!\d)/g;
    for (const f of files) {
      for (const m of read(f).match(mobile) ?? []) {
        if (!/^0900-000-\d{3}$/.test(m)) offenders.push(`${f}: ${m}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("AC-010 seed 的房客與廠商電話是 0900-000-001～003", () => {
    const seed = read("prisma/seed.ts");
    expect(seed.match(/0900-000-\d{3}/g)).toEqual(["0900-000-001", "0900-000-002", "0900-000-003"]);
  });

  it("AC-010 seed 與測試使用的 Email 都在保留給測試的網域", () => {
    const offenders: string[] = [];
    const email = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
    const allowed = /(\.test|\.example|@example\.com|@anthropic\.com|@users\.noreply\.github\.com)$/;
    for (const f of files.filter((x) => x === "prisma/seed.ts" || /\.test\.ts$/.test(x) || x.startsWith("e2e/") || x.startsWith("tests/"))) {
      for (const m of read(f).match(email) ?? []) {
        // 「user@127.0.0.1」這種是 SSRF 測試用的 URL 帳號欄位，不是 Email
        if (/@\d+(\.\d+)+$/.test(m)) continue;
        if (!allowed.test(m)) offenders.push(`${f}: ${m}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("AC-010 repo 內沒有像真的 Stripe 金鑰或 webhook secret", () => {
    const offenders: string[] = [];
    const secret = /sk_live_[A-Za-z0-9]|rk_live_[A-Za-z0-9]|whsec_[A-Za-z0-9]{20,}|sk_test_[A-Za-z0-9]{20,}/;
    for (const f of files) {
      if (secret.test(read(f))) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  it("AC-010 fixture 的 ICS 只使用保留給測試的網域", () => {
    for (const f of files.filter((x) => x.endsWith(".ics"))) {
      const text = read(f);
      for (const host of text.match(/https?:\/\/[^/\s\\]+/g) ?? []) {
        expect(host, f).toMatch(/\.test$/);
      }
      for (const uid of text.match(/^UID:.*(?:\r?\n[ \t].*)*/gm) ?? []) {
        expect(uid.replace(/\r?\n[ \t]/g, ""), f).toMatch(/@fixture\.hotel-pm\.test$/);
      }
    }
  });
});

describe("AC-010 未定事項維持現狀（待 Sean 決定）", () => {
  it("AC-010 Business 方案價格未被更動：方案頁、首頁、結帳頁仍是 NT$1,499", () => {
    for (const f of ["src/app/pricing/page.tsx", "src/app/page.tsx", "src/app/checkout/page.tsx"]) {
      expect(read(f), f).toContain("NT$1,499");
      expect(read(f), f).not.toContain("NT$1,999");
    }
    expect(read("src/app/pricing/page.tsx")).toContain("NT$499");
  });

  it("AC-010 公開註冊沒有重開：註冊 API 仍回 410、/register 仍轉到 /login", () => {
    const api = read("src/app/api/auth/register/route.ts");
    expect(api).toMatch(/status: 410/);
    expect(api).not.toMatch(/INSERT INTO/i);
    expect(read("src/app/register/page.tsx")).toMatch(/redirect\("\/login"\)/);
  });
});
