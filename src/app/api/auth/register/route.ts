import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "目前暫停開放註冊，請使用既有帳號登入" },
    { status: 410 }
  );
}
