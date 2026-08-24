import { getSql } from "@/db";
import { observeCancellableDatabaseOperation } from "@/lib/db/observability";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await observeCancellableDatabaseOperation(
      "health.database",
      getSql()`select 1`,
    );
    return Response.json(
      {
        status: "ok",
        database: "connected",
        checkedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        status: "degraded",
        database: "unavailable",
        checkedAt: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
