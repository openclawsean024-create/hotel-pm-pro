import type { NextConfig } from "next";

// 安全標頭（AC-008，合併清單 #8）
// 來源：hotel-pm `next.config.mjs` 的 6 個安全標頭，改寫為主 repo 的 next.config.ts。
//
// CSP 與 Stripe Checkout：結帳流程是伺服器建立 Checkout Session 後，前端以
// `window.location.href = session.url` 做「頂層導頁」到 checkout.stripe.com，
// 不嵌入 iframe、不載入 Stripe.js、也不是表單送出，所以不受 script-src／frame-src／
// form-action 限制；`connect-src` 允許 https 以便日後需要時呼叫外部 API。
// 若未來改用 Stripe.js 或 Embedded Checkout，需在 script-src／frame-src 加入 https://js.stripe.com。
const isDev = process.env.NODE_ENV === "development";

export const contentSecurityPolicy = [
  "default-src 'self'",
  "img-src 'self' data: https:",
  "font-src 'self' https: data:",
  "style-src 'self' 'unsafe-inline'",
  // 'unsafe-inline' 是給 Next.js 內聯的 hydration script；開發模式的 React Refresh 另需 'unsafe-eval'。
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "connect-src 'self' https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "microphone=(), camera=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
