import { NextResponse } from "next/server";
import { synchronizeCatalog } from "@/lib/catalog/service";
import { requireEnv } from "@/lib/env";
import { pruneOperationalData } from "@/lib/scanner/service";
import { hasValidBearerAuthorization } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 240;

export async function GET(request: Request) {
  if (
    !hasValidBearerAuthorization(
      request.headers.get("authorization"),
      requireEnv("CRON_SECRET"),
    )
  ) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const result = await synchronizeCatalog();
  await pruneOperationalData();
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
