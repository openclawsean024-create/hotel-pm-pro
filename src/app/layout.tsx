// app/layout.tsx — Root layout
import type { Metadata } from "next";
import "./globals.css";
import { SessionProviderWrapper } from "@/components/SessionProviderWrapper";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "民宿管家 hotel-pm — 物業管理系統",
    template: "%s | 民宿管家 hotel-pm",
  },
  description: "台灣民宿與包租代管業者的純前端物業管理系統（PMS）：物業、房客、訂房、月報表、商用授權。月費 NT$499 起，比 Cloudbeds 便宜 80%。",
  keywords: ["民宿管理", "包租代管", "PMS", "物業管理", "飯店管理", "台灣"],
  openGraph: {
    type: "website",
    locale: "zh_TW",
    title: "民宿管家 hotel-pm",
    description: "台灣民宿與包租代管業者的物業管理系統",
    siteName: "民宿管家 hotel-pm",
  },
  twitter: { card: "summary_large_image", title: "民宿管家 hotel-pm" },
  robots: { index: true, follow: true },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
