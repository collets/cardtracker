import { NextResponse } from "next/server";
import { synchronizeCatalog } from "@/lib/catalog/service";
import { requireEnv } from "@/lib/env";
import { pruneOperationalData } from "@/lib/scanner/service";

export const dynamic = "force-dynamic";
export const maxDuration = 240;

export async function GET(request: Request) {
  if (
    request.headers.get("authorization") !==
    `Bearer ${requireEnv("CRON_SECRET")}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await synchronizeCatalog();
  await pruneOperationalData();
  return NextResponse.json(result);
}
