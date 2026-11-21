// AC-001 測試基線回歸測試：確保 `npm test` 是真的測試、CI 的測試失敗會擋下 build／deploy。
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};
const ci = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");

/** 取出某個 job 區塊的文字（到下一個同層級 job 或檔尾為止）。 */
function jobBlock(name: string): string {
  const m = new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [a-z0-9_-]+:\\n|(?![\\s\\S]))`, "m").exec(ci);
  if (!m) throw new Error(`CI 找不到 job: ${name}`);
  return m[1];
}

function needsOf(name: string): string[] {
  const m = /^\s+needs:\s*\[([^\]]*)\]/m.exec(jobBlock(name));
  return m ? m[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
}

describe("AC-001 測試基線", () => {
  it("AC-001 npm test 執行 Vitest，不是 echo", () => {
    expect(pkg.scripts.test).toBe("vitest run");
    expect(pkg.scripts.test).not.toMatch(/echo/);
  });

  it("AC-001 npm run lint 是真正的 ESLint，不是 tsc", () => {
    expect(pkg.scripts.lint).toMatch(/^eslint\b/);
    expect(pkg.scripts.lint).not.toMatch(/tsc/);
    expect(pkg.scripts.typecheck).toBe("tsc --noEmit");
  });

  it("AC-001 有 test:e2e script（Playwright）", () => {
    expect(pkg.scripts["test:e2e"]).toBe("playwright test");
  });

  it("AC-001 CI 沒有任何 continue-on-error", () => {
    expect(ci).not.toMatch(/continue-on-error/);
  });

  it("AC-001 CI 安裝步驟不得用 `|| npm install` 之類的後備指令吞掉失敗", () => {
    expect(ci).not.toMatch(/\|\|/);
  });

  it("AC-001 CI 的 test job 執行 npm test、lint job 執行 lint 與 typecheck", () => {
    expect(jobBlock("test")).toMatch(/run: npm test\n/);
    expect(jobBlock("lint")).toMatch(/run: npm run lint\n/);
    expect(jobBlock("lint")).toMatch(/run: npm run typecheck\n/);
  });

  it("AC-001 build 的 needs 鏈包含 lint 與 test", () => {
    expect(needsOf("build")).toEqual(expect.arrayContaining(["lint", "test"]));
  });

  it("AC-001 CI 有 E2E job，且在 lint 與 test 之後執行", () => {
    expect(jobBlock("e2e")).toMatch(/run: npm run test:e2e\n/);
    expect(needsOf("e2e")).toEqual(expect.arrayContaining(["lint", "test"]));
  });

  it("AC-001 deploy 必須等 build 與 e2e 都通過", () => {
    expect(needsOf("deploy")).toEqual(expect.arrayContaining(["build", "e2e"]));
  });
});
