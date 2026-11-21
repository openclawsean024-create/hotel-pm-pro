// proxy.ts — 集中式路由保護（AC-008）
//
// Next.js 16 把 `middleware` 檔案慣例改名為 `proxy`（見 node_modules/next/dist/docs 的 proxy 章節），
// 功能相同：在請求進到頁面前執行。這裡只做一件事——未登入造訪 /dashboard/** 一律轉到 /login。
// 各 API route 仍各自檢查 session 並回 401（API 不轉址）。
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const proxy = auth((req) => {
  if (!req.auth?.user) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
