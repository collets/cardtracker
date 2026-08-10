import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";
import { handleTelegramUpdate } from "@/lib/telegram/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (
    request.headers.get("x-telegram-bot-api-secret-token") !==
    requireEnv("TELEGRAM_WEBHOOK_SECRET")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await handleTelegramUpdate(await request.json()));
}
