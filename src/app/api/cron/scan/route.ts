import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";
import { runMarketScanner } from "@/lib/scanner/service";
import { dispatchScheduledScanDiagnostics } from "@/lib/telegram/service";

export const dynamic = "force-dynamic";
export const maxDuration = 240;

export async function GET(request: Request) {
  if (
    request.headers.get("authorization") !==
    `Bearer ${requireEnv("CRON_SECRET")}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runMarketScanner();
  const diagnostics = await dispatchScheduledScanDiagnostics(result);
  return NextResponse.json({ ...result, diagnostics });
}
