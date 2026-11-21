// lib/safe-fetch.ts — 伺服器端抓取使用者提供的 URL（AC-007，SSRF 防護）
//
// 防護內容：
//   1. 只允許 https，且只允許預設連接埠（443）；不允許 URL 內帶帳號密碼。
//   2. 拒絕 localhost、內部網域名稱，以及私有／保留／loopback／link-local（含雲端 metadata
//      169.254.169.254）的 IP 位址。主機名稱會先做 DNS 解析，任何一筆解析結果落在封鎖範圍就拒絕。
//   3. 轉址不自動跟隨；每一跳都重新檢查，最多 3 跳。
//   4. 整個請求（含讀取內容）有逾時；回應內容有大小上限。
//
// 已知限制：DNS 檢查與實際連線之間仍有極短的時間差（DNS rebinding）。要完全排除需把連線
// 綁定到已檢查過的 IP，列為 M2 的強化項目（見 STATUS.md）。
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const DEFAULT_MAX_REDIRECTS = 3;

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}
export class FetchTimeoutError extends Error {
  constructor(message = "來源逾時未回應") {
    super(message);
    this.name = "FetchTimeoutError";
  }
}
export class ResponseTooLargeError extends Error {
  constructor(message = "回應內容超過大小上限") {
    super(message);
    this.name = "ResponseTooLargeError";
  }
}
export class UpstreamError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

// ---------- IP 位址判斷 ----------

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

const inRange = (n: number, base: string, bits: number): boolean => {
  const b = ipv4ToInt(base)!;
  const size = 2 ** (32 - bits);
  return n >= b && n < b + size;
};

/** 不可連線的 IPv4 範圍：私有、loopback、link-local、CGNAT、保留與文件用位址等。 */
const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8], // 「本機」網段
  ["10.0.0.0", 8], // 私有
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local（含雲端 metadata 169.254.169.254）
  ["172.16.0.0", 12], // 私有
  ["192.0.0.0", 24], // IETF 協定保留
  ["192.0.2.0", 24], // 文件用
  ["192.88.99.0", 24], // 6to4 relay（已廢止）
  ["192.168.0.0", 16], // 私有
  ["198.18.0.0", 15], // 效能測試
  ["198.51.100.0", 24], // 文件用
  ["203.0.113.0", 24], // 文件用
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // 保留與廣播
];

function isBlockedV4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true;
  return BLOCKED_V4.some(([base, bits]) => inRange(n, base, bits));
}

/** 把 IPv6 字串展開成 8 個 16-bit 數字；格式不合回 null。 */
function parseIpv6(ip: string): number[] | null {
  let s = ip.split("%")[0]; // 去掉 zone id
  const lastColon = s.lastIndexOf(":");
  const tail = s.slice(lastColon + 1);
  if (tail.includes(".")) {
    const n = ipv4ToInt(tail);
    if (n === null) return null;
    s = `${s.slice(0, lastColon + 1)}${Math.floor(n / 65536).toString(16)}:${(n % 65536).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    out.push(parseInt(g, 16));
  }
  return out.length === 8 ? out : null;
}

const embeddedV4 = (hi: number, lo: number): string =>
  `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;

function isBlockedV6(ip: string): boolean {
  const g = parseIpv6(ip);
  if (!g) return true;
  const allZero = (from: number, to: number) => g.slice(from, to).every((x) => x === 0);

  if (allZero(0, 8)) return true; // ::
  if (allZero(0, 7) && g[7] === 1) return true; // ::1
  if (allZero(0, 5) && g[5] === 0xffff) return isBlockedV4(embeddedV4(g[6], g[7])); // IPv4-mapped
  if (allZero(0, 6)) return isBlockedV4(embeddedV4(g[6], g[7])); // IPv4-compatible（已廢止）
  if (g[0] === 0x64 && g[1] === 0xff9b && allZero(2, 6)) return isBlockedV4(embeddedV4(g[6], g[7])); // NAT64
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 1) return true; // 本地 NAT64
  if (g[0] === 0x2002) return isBlockedV4(embeddedV4(g[1], g[2])); // 6to4
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local（已廢止）
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // 文件用
  if (g[0] === 0x2001 && g[1] === 0) return true; // Teredo
  if (g[0] === 0x0100 && allZero(1, 4)) return true; // discard-only
  return false;
}

/** 這個 IP 位址是否在封鎖範圍（私有、保留、loopback、link-local…）。無法解析的字串一律視為封鎖。 */
export function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isBlockedV4(ip);
  if (version === 6) return isBlockedV6(ip);
  return true;
}

// ---------- URL 檢查 ----------

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa", ".intranet", ".corp"];

/** 不需要 DNS 的語法檢查；通過時回傳解析後的 URL。 */
export function validateUrlSyntax(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("連結格式錯誤");
  }
  if (url.protocol !== "https:") {
    throw new UnsafeUrlError("連結僅支援 https");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("連結不可包含帳號或密碼");
  }
  if (url.port && url.port !== "443") {
    throw new UnsafeUrlError("連結僅支援預設連接埠（443）");
  }
  const host = hostnameOf(url);
  if (!host) throw new UnsafeUrlError("連結缺少主機名稱");

  if (isIP(host)) {
    if (isBlockedAddress(host)) throw new UnsafeUrlError("不允許連到內部或保留的 IP 位址");
    return url;
  }
  const lower = host.toLowerCase().replace(/\.$/, "");
  if (lower === "localhost" || BLOCKED_HOST_SUFFIXES.some((s) => lower.endsWith(s)) || !lower.includes(".")) {
    throw new UnsafeUrlError("不允許連到本機或內部網路的主機");
  }
  return url;
}

function hostnameOf(url: URL): string {
  return url.hostname.startsWith("[") ? url.hostname.slice(1, -1) : url.hostname;
}

/** 語法檢查 + DNS 解析檢查。任何一筆解析結果在封鎖範圍就拒絕。 */
export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  const url = validateUrlSyntax(rawUrl);
  const host = hostnameOf(url);
  if (isIP(host)) return url;

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new UpstreamError("無法解析主機名稱");
  }
  if (addresses.length === 0) throw new UpstreamError("無法解析主機名稱");
  if (addresses.some((a) => isBlockedAddress(a.address))) {
    throw new UnsafeUrlError("不允許連到內部或保留的 IP 位址");
  }
  return url;
}

// ---------- 抓取 ----------

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

/**
 * 以 SSRF 防護抓取文字內容。
 * 失敗時拋 UnsafeUrlError／FetchTimeoutError／ResponseTooLargeError／UpstreamError。
 */
export async function safeFetchText(rawUrl: string, options: SafeFetchOptions = {}): Promise<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const aborted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener("abort", () => reject(new FetchTimeoutError()), { once: true });
  });
  aborted.catch(() => {}); // 避免沒人接的 rejection

  const run = async (): Promise<string> => {
    let current = rawUrl;
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const url = await assertSafeUrl(current);
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: "manual",
        cache: "no-store",
        headers: { accept: "text/calendar, text/plain;q=0.9, */*;q=0.1" },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) throw new UpstreamError("來源回應轉址但沒有目的地", res.status);
        current = new URL(location, url).toString();
        continue;
      }
      if (!res.ok) throw new UpstreamError(`來源回應 ${res.status}`, res.status);

      const declared = Number(res.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > maxBytes) throw new ResponseTooLargeError();
      return await readLimited(res, maxBytes);
    }
    throw new UnsafeUrlError("轉址次數過多");
  };

  try {
    return await Promise.race([run(), aborted]);
  } catch (err) {
    if (controller.signal.aborted) throw new FetchTimeoutError();
    if (
      err instanceof UnsafeUrlError ||
      err instanceof ResponseTooLargeError ||
      err instanceof UpstreamError ||
      err instanceof FetchTimeoutError
    ) {
      throw err;
    }
    throw new UpstreamError("無法取得內容");
  } finally {
    clearTimeout(timer);
  }
}

async function readLimited(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) {
    const text = await res.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new ResponseTooLargeError();
    return text;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new ResponseTooLargeError();
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder("utf-8").decode(merged);
}
