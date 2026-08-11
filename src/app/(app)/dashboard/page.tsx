import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { BellRing, Plus, RefreshCw, Trash2 } from "lucide-react";
import { getDb } from "@/db";
import {
  alerts,
  blueprints,
  expansions,
  watches,
  watchMetrics,
} from "@/db/schema";
import {
  removeWatchAction,
  scanAllWatchesAction,
  scanWatchAction,
} from "@/app/(app)/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CardArt } from "@/components/card-art";
import { PageHeading } from "@/components/page-heading";
import { ActionForm, ActionSubmitButton } from "@/components/action-feedback";
import { requireUser } from "@/lib/auth/guards";
import { formatEuro } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireUser();
  const rows = await getDb()
    .select({
      watch: watches,
      card: blueprints,
      expansion: expansions,
      metric: watchMetrics,
    })
    .from(watches)
    .innerJoin(blueprints, eq(blueprints.id, watches.blueprintId))
    .innerJoin(expansions, eq(expansions.id, blueprints.expansionId))
    .leftJoin(watchMetrics, eq(watchMetrics.watchId, watches.id))
    .where(and(eq(watches.userId, user.id), eq(watches.active, true)))
    .orderBy(desc(watches.createdAt));

  const unreadDeals = await getDb()
    .select({ id: alerts.id })
    .from(alerts)
    .innerJoin(watches, eq(watches.id, alerts.watchId))
    .where(
      and(
        eq(watches.userId, user.id),
        eq(alerts.state, "active"),
        isNull(alerts.readAt),
      ),
    );

  return (
    <>
      <PageHeading
        eyebrow="Watchlist"
        title="Market overview"
        description={`${rows.length} active watches · prices exclude shipping`}
        actions={
          <>
            {rows.length > 0 ? (
              <ActionForm action={scanAllWatchesAction}>
                <ActionSubmitButton
                  variant="outline"
                  pendingLabel="Scanning all…"
                  title="Refresh prices for every active watch"
                >
                  <RefreshCw className="size-4" /> Scan all
                </ActionSubmitButton>
              </ActionForm>
            ) : null}
            <Button asChild>
              <Link href="/cards">
                <Plus className="size-4" /> Track a card
              </Link>
            </Button>
          </>
        }
      />
      {unreadDeals.length ? (
        <Link
          href="/alerts"
          className="mb-6 flex items-center justify-between rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-emerald-100"
        >
          <span className="flex items-center gap-3">
            <BellRing className="size-5" /> {unreadDeals.length} active deal
            {unreadDeals.length === 1 ? "" : "s"} need attention
          </span>
          <span className="text-sm">Review alerts →</span>
        </Link>
      ) : null}
      {rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-72 flex-col items-center justify-center text-center">
            <h2 className="text-lg font-medium">Your watchlist is empty</h2>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              Search the Riftbound singles catalog and choose the exact
              marketplace filters you care about.
            </p>
            <Button asChild className="mt-5">
              <Link href="/cards">Discover cards</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map(({ watch, card, expansion, metric }) => (
            <Card
              key={watch.id}
              className={
                metric?.qualifies
                  ? "border-emerald-300/30 bg-emerald-300/[0.04]"
                  : undefined
              }
            >
              <CardContent className="grid grid-cols-[88px_1fr] gap-4 p-4 sm:grid-cols-[112px_1fr]">
                <CardArt
                  src={card.imageUrl}
                  alt={card.name}
                  sizes="(max-width: 639px) 88px, 112px"
                  className="aspect-[0.716]"
                />
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{card.name}</p>
                      <p className="mt-1 truncate text-xs text-slate-400">
                        {expansion.name} · {card.collectorNumber ?? "No number"}
                        {card.version ? ` · ${card.version}` : ""}
                      </p>
                    </div>
                    {metric?.qualifies ? (
                      <Badge variant="success">Deal</Badge>
                    ) : (
                      <Badge variant="muted">Watching</Badge>
                    )}
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <Metric
                      label="Lowest"
                      value={formatEuro(metric?.bestPriceCents)}
                    />
                    <Metric
                      label="Reference"
                      value={formatEuro(metric?.referencePriceCents)}
                    />
                    <Metric
                      label="Discount"
                      value={
                        metric?.discountBps != null
                          ? `${(metric.discountBps / 100).toFixed(1)}%`
                          : "—"
                      }
                    />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/watches/${watch.id}`}>Details</Link>
                    </Button>
                    <ActionForm action={scanWatchAction}>
                      <input type="hidden" name="watchId" value={watch.id} />
                      <ActionSubmitButton
                        size="sm"
                        variant="ghost"
                        pendingLabel="Scanning…"
                      >
                        <RefreshCw className="size-3.5" /> Scan
                      </ActionSubmitButton>
                    </ActionForm>
                    <ActionForm action={removeWatchAction} className="ml-auto">
                      <input type="hidden" name="watchId" value={watch.id} />
                      <ActionSubmitButton
                        size="sm"
                        variant="ghost"
                        aria-label={`Remove ${card.name}`}
                        pendingLabel="Removing…"
                      >
                        <Trash2 className="size-3.5" />
                      </ActionSubmitButton>
                    </ActionForm>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
