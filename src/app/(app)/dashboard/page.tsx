import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import {
  BellRing,
  ChevronRight,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { getDb } from "@/db";
import { blueprints, expansions, watches, watchMetrics } from "@/db/schema";
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
import { getAttentionCounts } from "@/lib/attention/counts";
import { cn, formatEuro } from "@/lib/utils";

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

  const attention = await getAttentionCounts(user.id);

  return (
    <>
      <PageHeading
        eyebrow="Watchlist"
        title="Market overview"
        description={`${rows.length} active watches · prices exclude shipping`}
        actions={
          <>
            {rows.length > 0 && user.kind !== "guest" ? (
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
      {attention.total > 0 ? (
        <section
          aria-labelledby="attention-heading"
          className="mb-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-300/15 text-cyan-200">
              <BellRing className="size-4.5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="attention-heading" className="font-medium text-cyan-50">
                {attention.total} {attention.total === 1 ? "item" : "items"}{" "}
                need your attention
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Deals may be time-sensitive; suggestions help calibrate a watch
                before future scans.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <AttentionLink
              href="/alerts"
              icon={BellRing}
              count={attention.unreadDeals}
              singular="unread deal"
              plural="unread deals"
              emptyLabel="No unread deals"
              tone="deal"
            />
            <AttentionLink
              href="/alerts?view=recommendations"
              icon={SlidersHorizontal}
              count={attention.pendingRecommendations}
              singular="watch suggestion"
              plural="watch suggestions"
              emptyLabel="No watch suggestions"
              tone="recommendation"
            />
          </div>
        </section>
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
                    {user.kind !== "guest" ? (
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
                    ) : null}
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

function AttentionLink({
  href,
  icon: Icon,
  count,
  singular,
  plural,
  emptyLabel,
  tone,
}: {
  href: string;
  icon: typeof BellRing;
  count: number;
  singular: string;
  plural: string;
  emptyLabel: string;
  tone: "deal" | "recommendation";
}) {
  const active = count > 0;
  const content = (
    <>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-sm font-medium">
        {active ? `${count} ${count === 1 ? singular : plural}` : emptyLabel}
      </span>
      {active ? (
        <ChevronRight
          className="size-4 shrink-0 transition-colors group-hover:text-white"
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  if (!active) {
    return (
      <div className="flex min-h-12 items-center gap-3 rounded-xl border border-white/5 bg-black/10 px-3 py-2.5 text-slate-500">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
        tone === "deal"
          ? "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100 hover:border-emerald-300/35 hover:bg-emerald-300/10"
          : null,
        tone === "recommendation"
          ? "border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-100 hover:border-cyan-300/35 hover:bg-cyan-300/10"
          : null,
      )}
    >
      {content}
    </Link>
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
