import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { markAlertReadAction } from "@/app/(app)/actions";
import { getDb } from "@/db";
import {
  alertFeedback,
  alerts,
  blueprints,
  expansions,
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
import { formatEuro } from "@/lib/utils";

export default async function AlertsPage() {
  const user = await requireUser();
  const rows = await getDb()
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
    .where(and(eq(watches.userId, user.id)))
    .orderBy(desc(alerts.lastSeenAt))
    .limit(100);
  return (
    <>
      <PageHeading
        eyebrow="Signals"
        title="Deal alerts"
        description="A listing appears here only after it clears both your relative and absolute thresholds."
      />
      <div className="grid gap-4">
        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-20 text-center text-sm text-slate-400">
              No deals detected yet.
            </CardContent>
          </Card>
        ) : (
          rows.map(({ alert, card, expansion, feedback }) => (
            <Card
              key={alert.id}
              className={
                alert.state === "active"
                  ? "border-emerald-300/25"
                  : "opacity-65"
              }
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
                      {alert.state}
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
                    {alert.candidate.seller.countryCode ?? "unknown country"} ·
                    listing {alert.productId}
                  </p>
                </div>
                <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:justify-end">
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
                  {!alert.readAt ? (
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
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
