import Link from "next/link";
import { and, desc, eq, isNotNull, isNull, ne, or } from "drizzle-orm";
import {
  Archive,
  BellRing,
  ExternalLink,
  Inbox,
  SlidersHorizontal,
} from "lucide-react";
import {
  archiveAlertAction,
  markAlertReadAction,
  restoreAlertToInboxAction,
} from "@/app/(app)/actions";
import { getDb } from "@/db";
import {
  alertFeedback,
  alerts,
  blueprints,
  expansions,
  thresholdRecommendations,
  watches,
} from "@/db/schema";
import { AlertFeedbackDialog } from "@/components/alert-feedback";
import { CardArt } from "@/components/card-art";
import { ActionForm, ActionSubmitButton } from "@/components/action-feedback";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/guards";
import { getCardTraderBlueprintUrl } from "@/lib/cardtrader/links";
import { getAttentionCounts } from "@/lib/attention/counts";
import { cn, formatEuro } from "@/lib/utils";

type AlertView = "inbox" | "recommendations" | "history";

function alertStatus(alert: typeof alerts.$inferSelect) {
  if (alert.state === "dismissed") return "Archived";
  if (alert.state === "expired") return "No longer current";
  return "Current deal";
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireUser();
  const attention = await getAttentionCounts(user.id);
  const params = await searchParams;
  const view: AlertView =
    params.view === "history"
      ? "history"
      : params.view === "recommendations"
        ? "recommendations"
        : "inbox";
  const rows =
    view === "recommendations"
      ? []
      : await getDb()
          .select({
            alert: alerts,
            card: blueprints,
            expansion: expansions,
            feedback: alertFeedback,
          })
          .from(alerts)
          .innerJoin(watches, eq(watches.id, alerts.watchId))
          .innerJoin(blueprints, eq(blueprints.id, watches.blueprintId))
          .innerJoin(expansions, eq(expansions.id, blueprints.expansionId))
          .leftJoin(alertFeedback, eq(alertFeedback.alertId, alerts.id))
          .where(
            and(
              eq(watches.userId, user.id),
              view === "inbox"
                ? and(eq(alerts.state, "active"), isNull(alerts.readAt))
                : or(ne(alerts.state, "active"), isNotNull(alerts.readAt)),
            ),
          )
          .orderBy(desc(alerts.lastSeenAt), desc(alerts.firstSeenAt))
          .limit(100);
  const recommendations =
    view === "recommendations"
      ? await getDb()
          .select({
            recommendation: thresholdRecommendations,
            watch: watches,
            card: blueprints,
            expansion: expansions,
          })
          .from(thresholdRecommendations)
          .innerJoin(watches, eq(watches.id, thresholdRecommendations.watchId))
          .innerJoin(blueprints, eq(blueprints.id, watches.blueprintId))
          .innerJoin(expansions, eq(expansions.id, blueprints.expansionId))
          .where(
            and(
              eq(watches.userId, user.id),
              eq(thresholdRecommendations.status, "pending"),
            ),
          )
          .orderBy(desc(thresholdRecommendations.createdAt))
          .limit(100)
      : [];

  return (
    <>
      <PageHeading
        eyebrow="Signals"
        title="Alerts and recommendations"
        description="Review new deals and price-aware watch suggestions in one place."
      />
      <nav
        className="mb-5 grid w-full grid-cols-3 gap-1 rounded-xl border border-white/10 bg-slate-950/50 p-1 sm:flex sm:w-fit"
        aria-label="Alert views"
      >
        <Link
          href="/alerts"
          prefetch={false}
          className={cn(
            "flex h-10 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors sm:min-w-28 sm:gap-2 sm:px-3 sm:text-sm",
            view === "inbox"
              ? "bg-cyan-300/15 text-cyan-100"
              : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
          )}
        >
          <Inbox className="size-4" /> Inbox
          {attention.unreadDeals > 0 ? (
            <span className="min-w-5 rounded-full bg-emerald-300 px-1.5 py-0.5 text-center text-[10px] leading-4 font-semibold text-slate-950">
              {attention.unreadDeals > 99 ? "99+" : attention.unreadDeals}
            </span>
          ) : null}
        </Link>
        <Link
          href="/alerts?view=recommendations"
          prefetch={false}
          className={cn(
            "flex h-10 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors sm:min-w-28 sm:gap-2 sm:px-3 sm:text-sm",
            view === "recommendations"
              ? "bg-cyan-300/15 text-cyan-100"
              : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
          )}
        >
          <SlidersHorizontal className="size-4" />
          <span className="sm:hidden">Suggestions</span>
          <span className="hidden sm:inline">Recommendations</span>
          {attention.pendingRecommendations > 0 ? (
            <span className="min-w-5 rounded-full bg-cyan-300 px-1.5 py-0.5 text-center text-[10px] leading-4 font-semibold text-slate-950">
              {attention.pendingRecommendations > 99
                ? "99+"
                : attention.pendingRecommendations}
            </span>
          ) : null}
        </Link>
        <Link
          href="/alerts?view=history"
          prefetch={false}
          className={cn(
            "flex h-10 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors sm:min-w-28 sm:gap-2 sm:px-3 sm:text-sm",
            view === "history"
              ? "bg-cyan-300/15 text-cyan-100"
              : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
          )}
        >
          <Archive className="size-4" /> History
        </Link>
      </nav>
      {view === "recommendations" ? (
        <div className="grid gap-4">
          {recommendations.length === 0 ? (
            <Card>
              <CardContent className="py-20 text-center text-sm text-slate-400">
                No threshold suggestions right now. They appear after a first
                scan finds enough comparable listings.
              </CardContent>
            </Card>
          ) : (
            recommendations.map(
              ({ recommendation, watch, card, expansion }) => (
                <Card key={recommendation.id} className="border-cyan-300/25">
                  <CardContent className="grid grid-cols-[72px_1fr] gap-4 p-4 sm:grid-cols-[88px_1fr_auto] sm:items-center">
                    <CardArt
                      src={card.imageUrl}
                      alt={card.name}
                      sizes="(max-width: 639px) 72px, 88px"
                      className="aspect-[0.716]"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{card.name}</p>
                        <Badge variant="warning">Review thresholds</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {expansion.name} ·{" "}
                        {card.version ?? card.collectorNumber}
                      </p>
                      <p className="mt-3 text-sm text-slate-300">
                        Keep {recommendation.proposedDiscountPercent}% and
                        reduce minimum saving from{" "}
                        {formatEuro(recommendation.currentMinSavingsCents)} to{" "}
                        <strong className="text-cyan-100">
                          {formatEuro(recommendation.proposedMinSavingsCents)}
                        </strong>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Based on {recommendation.eligibleCount} listings and a{" "}
                        {formatEuro(recommendation.referencePriceCents)}{" "}
                        reference.
                      </p>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <Button
                        asChild
                        className="h-10 w-full sm:h-8 sm:w-auto"
                        size="sm"
                      >
                        <Link
                          href={`/watches/${watch.id}?recommendation=${recommendation.id}`}
                          prefetch={false}
                        >
                          Review <BellRing className="size-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ),
            )
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {rows.length === 0 ? (
            <Card>
              <CardContent className="py-20 text-center text-sm text-slate-400">
                {view === "inbox"
                  ? "No new deals right now. Your active watches will keep scanning."
                  : "No read, archived, or expired alerts yet."}
              </CardContent>
            </Card>
          ) : (
            rows.map(({ alert, card, expansion, feedback }) => (
              <Card
                key={alert.id}
                className={cn(
                  alert.state === "active"
                    ? "border-emerald-300/25"
                    : "opacity-75",
                  alert.state === "dismissed" && "border-slate-700/80",
                )}
              >
                <CardContent className="grid grid-cols-[72px_1fr] gap-4 p-4 sm:grid-cols-[88px_1fr_auto] sm:items-center">
                  <CardArt
                    src={card.imageUrl}
                    alt={card.name}
                    sizes="(max-width: 639px) 72px, 88px"
                    className="aspect-[0.716]"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{card.name}</p>
                      <Badge
                        variant={alert.state === "active" ? "success" : "muted"}
                      >
                        {alertStatus(alert)}
                      </Badge>
                      <Badge variant="muted">{alert.confidence}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {expansion.name} · {card.version ?? card.collectorNumber}
                    </p>
                    <p className="mt-3 text-sm">
                      <strong>{formatEuro(alert.candidatePriceCents)}</strong>
                      <span className="text-slate-500">
                        {" "}
                        vs {formatEuro(alert.referencePriceCents)} ·{" "}
                      </span>
                      <span className="text-emerald-300">
                        {(alert.discountBps / 100).toFixed(1)}% below
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {alert.candidate.seller.username} ·{" "}
                      {alert.candidate.seller.countryCode ?? "unknown country"}{" "}
                      · listing {alert.productId}
                    </p>
                  </div>
                  <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:max-w-72 sm:justify-end">
                    <Button
                      asChild
                      size="sm"
                      className="h-10 flex-1 sm:h-8 sm:flex-none"
                    >
                      <Link
                        href={getCardTraderBlueprintUrl(card.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        CardTrader <ExternalLink className="size-3.5" />
                      </Link>
                    </Button>
                    <AlertFeedbackDialog
                      alertId={alert.id}
                      currentOutcome={feedback?.outcome ?? null}
                    />
                    {!alert.readAt && alert.state === "active" ? (
                      <ActionForm action={markAlertReadAction}>
                        <input type="hidden" name="alertId" value={alert.id} />
                        <ActionSubmitButton
                          size="sm"
                          variant="ghost"
                          className="h-10 sm:h-8"
                          pendingLabel="Saving…"
                        >
                          Mark read
                        </ActionSubmitButton>
                      </ActionForm>
                    ) : null}
                    {alert.state === "dismissed" ? (
                      <ActionForm action={restoreAlertToInboxAction}>
                        <input type="hidden" name="alertId" value={alert.id} />
                        <ActionSubmitButton
                          size="sm"
                          variant="outline"
                          className="h-10 sm:h-8"
                          pendingLabel="Restoring…"
                        >
                          Restore to Inbox
                        </ActionSubmitButton>
                      </ActionForm>
                    ) : (
                      <ActionForm action={archiveAlertAction}>
                        <input type="hidden" name="alertId" value={alert.id} />
                        <ActionSubmitButton
                          size="sm"
                          variant="ghost"
                          className="h-10 sm:h-8"
                          pendingLabel="Archiving…"
                        >
                          Archive
                        </ActionSubmitButton>
                      </ActionForm>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </>
  );
}
