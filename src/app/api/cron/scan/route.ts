import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";
import { runMarketScanner } from "@/lib/scanner/service";

export const dynamic = "force-dynamic";
export const maxDuration = 240;

export async function GET(request: Request) {
  if (
    request.headers.get("authorization") !==
    `Bearer ${requireEnv("CRON_SECRET")}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runMarketScanner());
}
