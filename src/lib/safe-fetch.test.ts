// AC-007 SSRF 防護測試：只允許 https、擋內網與保留位址、限制大小與逾時、轉址逐跳檢查。
// DNS 與 fetch 都以 mock 取代，不會發出任何真實的網路請求。
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

import { lookup } from "node:dns/promises";
import {
  assertSafeUrl,
  FetchTimeoutError,
  isBlockedAddress,
  ResponseTooLargeError,
  safeFetchText,
  UnsafeUrlError,
  UpstreamError,
  validateUrlSyntax,
} from "@/lib/safe-fetch";

const PUBLIC_IP = "93.184.216.34";
const fetchMock = vi.fn();

function dnsReturns(...addresses: string[]) {
  (lookup as unknown as Mock).mockResolvedValue(addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  dnsReturns(PUBLIC_IP);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("AC-007 isBlockedAddress", () => {
  it("AC-007 擋下 loopback、私有、link-local、CGNAT 與保留的 IPv4", () => {
    for (const ip of [
      "127.0.0.1",
      "127.255.255.254",
      "10.0.0.1",
      "10.255.255.255",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // 雲端 metadata
      "169.254.0.1",
      "100.64.0.1",
      "0.0.0.0",
      "192.0.2.10",
      "198.18.0.1",
      "198.51.100.7",
      "203.0.113.9",
      "224.0.0.1",
      "255.255.255.255",
    ]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("AC-007 一般的公開 IPv4 不擋；私有範圍的邊界外也不擋", () => {
    for (const ip of [PUBLIC_IP, "8.8.8.8", "1.1.1.1", "172.15.255.255", "172.32.0.1", "11.0.0.1", "100.63.255.255", "100.128.0.1"]) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });

  it("AC-007 擋下 loopback、unique-local、link-local 與 IPv4-mapped 的 IPv6", () => {
    for (const ip of [
      "::1",
      "::",
      "fc00::1",
      "fd12:3456:789a::1",
      "fe80::1",
      "ff02::1",
      "::ffff:127.0.0.1",
      "::ffff:169.254.169.254",
      "::ffff:10.0.0.1",
      "::ffff:7f00:1",
      "64:ff9b::a00:1", // NAT64 對應 10.0.0.1
      "2002:7f00:1::", // 6to4 對應 127.0.0.1
      "2001:db8::1",
    ]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("AC-007 公開的 IPv6 不擋；IPv4-mapped 的公開位址不擋", () => {
    for (const ip of ["2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8"]) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });

  it("AC-007 不是 IP 的字串一律視為封鎖", () => {
    expect(isBlockedAddress("not-an-ip")).toBe(true);
    expect(isBlockedAddress("")).toBe(true);
  });
});

describe("AC-007 validateUrlSyntax：只允許 https", () => {
  it("AC-007 接受一般的 https 連結", () => {
    expect(validateUrlSyntax("https://calendar.example.test/fake.ics").hostname).toBe("calendar.example.test");
    expect(validateUrlSyntax("https://calendar.example.test:443/fake.ics").hostname).toBe("calendar.example.test");
  });

  it("AC-007 拒絕 http（含 http://127.0.0.1 與 http://169.254.169.254）", () => {
    for (const url of [
      "http://calendar.example.test/fake.ics",
      "http://127.0.0.1/fake.ics",
      "http://169.254.169.254/latest/meta-data/",
    ]) {
      expect(() => validateUrlSyntax(url), url).toThrow(UnsafeUrlError);
    }
  });

  it("AC-007 拒絕非 http(s) 的協定", () => {
    for (const url of ["file:///etc/passwd", "ftp://calendar.example.test/a.ics", "gopher://x.test/", "data:text/calendar,BEGIN", "javascript:alert(1)", "webcal://calendar.example.test/a.ics"]) {
      expect(() => validateUrlSyntax(url), url).toThrow(UnsafeUrlError);
    }
  });

  it("AC-007 拒絕格式錯誤的連結", () => {
    for (const url of ["", "not a url", "https://", "//calendar.example.test/a.ics"]) {
      expect(() => validateUrlSyntax(url), url).toThrow(UnsafeUrlError);
    }
  });

  it("AC-007 就算是 https，也拒絕 localhost、內部網域與單一標籤主機", () => {
    for (const url of [
      "https://localhost/a.ics",
      "https://LOCALHOST/a.ics",
      "https://foo.localhost/a.ics",
      "https://printer.local/a.ics",
      "https://db.internal/a.ics",
      "https://intranet/a.ics",
      "https://localhost./a.ics",
    ]) {
      expect(() => validateUrlSyntax(url), url).toThrow(/本機或內部網路/);
    }
  });

  it("AC-007 就算是 https，也拒絕私有與保留的 IP（含各種寫法）", () => {
    for (const url of [
      "https://127.0.0.1/a.ics",
      "https://169.254.169.254/latest/meta-data/",
      "https://10.0.0.5/a.ics",
      "https://192.168.0.10/a.ics",
      "https://172.16.5.4/a.ics",
      "https://0.0.0.0/a.ics",
      "https://2130706433/a.ics", // 十進位寫法的 127.0.0.1
      "https://0x7f.0.0.1/a.ics", // 十六進位寫法
      "https://0177.0.0.1/a.ics", // 八進位寫法
      "https://127.1/a.ics", // 縮寫
      "https://[::1]/a.ics",
      "https://[::ffff:127.0.0.1]/a.ics",
      "https://[fd00::1]/a.ics",
      "https://[fe80::1]/a.ics",
    ]) {
      expect(() => validateUrlSyntax(url), url).toThrow(/內部或保留的 IP/);
    }
  });

  it("AC-007 拒絕 URL 內帶帳號密碼（避免 https://trusted@evil 之類的混淆）", () => {
    expect(() => validateUrlSyntax("https://user:pass@calendar.example.test/a.ics")).toThrow(/帳號或密碼/);
    expect(() => validateUrlSyntax("https://calendar.example.test@127.0.0.1/a.ics")).toThrow(UnsafeUrlError);
  });

  it("AC-007 拒絕非預設連接埠", () => {
    for (const url of ["https://calendar.example.test:8443/a.ics", "https://calendar.example.test:22/", "https://calendar.example.test:6379/"]) {
      expect(() => validateUrlSyntax(url), url).toThrow(/連接埠/);
    }
  });
});

describe("AC-007 assertSafeUrl：DNS 解析結果也要檢查", () => {
  it("AC-007 主機名稱解析到公開 IP 時通過", async () => {
    await expect(assertSafeUrl("https://calendar.example.test/a.ics")).resolves.toBeInstanceOf(URL);
    expect(lookup).toHaveBeenCalledWith("calendar.example.test", { all: true, verbatim: true });
  });

  it("AC-007 主機名稱解析到 127.0.0.1 或 169.254.169.254 時拒絕", async () => {
    for (const ip of ["127.0.0.1", "169.254.169.254", "10.1.2.3", "::1", "fd00::1"]) {
      dnsReturns(ip);
      await expect(assertSafeUrl("https://rebind.example.test/a.ics"), ip).rejects.toThrow(UnsafeUrlError);
    }
  });

  it("AC-007 多筆解析結果中只要有一筆是內部位址就拒絕", async () => {
    dnsReturns(PUBLIC_IP, "192.168.1.20");
    await expect(assertSafeUrl("https://mixed.example.test/a.ics")).rejects.toThrow(/內部或保留的 IP/);
  });

  it("AC-007 DNS 解析失敗或沒有結果時拋 UpstreamError", async () => {
    (lookup as unknown as Mock).mockRejectedValue(new Error("ENOTFOUND"));
    await expect(assertSafeUrl("https://missing.example.test/a.ics")).rejects.toThrow(UpstreamError);
    (lookup as unknown as Mock).mockResolvedValue([]);
    await expect(assertSafeUrl("https://missing.example.test/a.ics")).rejects.toThrow(UpstreamError);
  });

  it("AC-007 語法就不合格的連結不會去查 DNS", async () => {
    await expect(assertSafeUrl("http://127.0.0.1/a.ics")).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeUrl("https://169.254.169.254/")).rejects.toThrow(UnsafeUrlError);
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe("AC-007 safeFetchText", () => {
  const okResponse = (body: string, headers: Record<string, string> = {}) =>
    new Response(body, { status: 200, headers: { "content-type": "text/calendar", ...headers } });

  it("AC-007 抓取成功時回傳文字，且不自動跟隨轉址", async () => {
    fetchMock.mockResolvedValue(okResponse("BEGIN:VCALENDAR"));
    await expect(safeFetchText("https://calendar.example.test/a.ics")).resolves.toBe("BEGIN:VCALENDAR");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.redirect).toBe("manual");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("AC-007 http://127.0.0.1 與 http://169.254.169.254 被拒，完全不發出請求", async () => {
    for (const url of ["http://127.0.0.1/a.ics", "http://169.254.169.254/latest/meta-data/", "https://127.0.0.1/a.ics", "https://169.254.169.254/"]) {
      await expect(safeFetchText(url), url).rejects.toThrow(UnsafeUrlError);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AC-007 DNS 指向內部位址時不發出請求", async () => {
    dnsReturns("169.254.169.254");
    await expect(safeFetchText("https://rebind.example.test/a.ics")).rejects.toThrow(UnsafeUrlError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AC-007 轉址到內部位址時在下一跳被拒", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data/" } }),
    );
    await expect(safeFetchText("https://calendar.example.test/a.ics")).rejects.toThrow(/內部或保留的 IP/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("AC-007 轉址到 http 時被拒", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 301, headers: { location: "http://calendar.example.test/a.ics" } }),
    );
    await expect(safeFetchText("https://calendar.example.test/a.ics")).rejects.toThrow(/僅支援 https/);
  });

  it("AC-007 合法的轉址會跟隨（相對路徑也可以），每一跳都重新做 DNS 檢查", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/v2/a.ics" } }))
      .mockResolvedValueOnce(okResponse("BEGIN:VCALENDAR"));
    await expect(safeFetchText("https://calendar.example.test/a.ics")).resolves.toBe("BEGIN:VCALENDAR");
    expect(String(fetchMock.mock.calls[1][0])).toBe("https://calendar.example.test/v2/a.ics");
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("AC-007 轉址超過 3 次時拒絕", async () => {
    fetchMock.mockImplementation(
      async () => new Response(null, { status: 302, headers: { location: "https://calendar.example.test/loop" } }),
    );
    await expect(safeFetchText("https://calendar.example.test/a.ics")).rejects.toThrow(/轉址次數過多/);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("AC-007 逾時：來源不回應時在指定時間後中止並拋 FetchTimeoutError", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: unknown, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    );
    const pending = safeFetchText("https://slow.example.test/a.ics", { timeoutMs: 10_000 });
    const assertion = expect(pending).rejects.toThrow(FetchTimeoutError);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it("AC-007 逾時也涵蓋 DNS 解析卡住的情況", async () => {
    vi.useFakeTimers();
    (lookup as unknown as Mock).mockImplementation(() => new Promise(() => {}));
    const pending = safeFetchText("https://slow-dns.example.test/a.ics", { timeoutMs: 5_000 });
    const assertion = expect(pending).rejects.toThrow(FetchTimeoutError);
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AC-007 大小上限：Content-Length 超過上限時直接拒絕", async () => {
    fetchMock.mockResolvedValue(okResponse("x", { "content-length": String(5 * 1024 * 1024) }));
    await expect(safeFetchText("https://calendar.example.test/a.ics", { maxBytes: 1024 })).rejects.toThrow(
      ResponseTooLargeError,
    );
  });

  it("AC-007 大小上限：沒有 Content-Length 時邊讀邊算，超過就中止", async () => {
    fetchMock.mockResolvedValue(okResponse("A".repeat(2048)));
    await expect(safeFetchText("https://calendar.example.test/a.ics", { maxBytes: 1024 })).rejects.toThrow(
      ResponseTooLargeError,
    );
  });

  it("AC-007 剛好等於上限的內容可以通過", async () => {
    fetchMock.mockResolvedValue(okResponse("A".repeat(1024)));
    await expect(safeFetchText("https://calendar.example.test/a.ics", { maxBytes: 1024 })).resolves.toHaveLength(1024);
  });

  it("AC-007 來源回 4xx／5xx 時拋 UpstreamError（帶狀態碼）", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 404 }));
    await expect(safeFetchText("https://calendar.example.test/a.ics")).rejects.toMatchObject({
      name: "UpstreamError",
      status: 404,
    });
  });

  it("AC-007 網路錯誤包成 UpstreamError，不洩漏底層錯誤細節", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed: ECONNREFUSED 10.0.0.1:443"));
    await expect(safeFetchText("https://calendar.example.test/a.ics")).rejects.toThrow("無法取得內容");
  });
});
