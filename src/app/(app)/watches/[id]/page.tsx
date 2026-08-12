import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, RefreshCw } from "lucide-react";
import { scanWatchAction, updateWatchAction } from "@/app/(app)/actions";
import { getDb } from "@/db";
import {
  blueprints,
  expansions,
  priceObservations,
  watches,
  watchMetrics,
} from "@/db/schema";
import { CardArt } from "@/components/card-art";
import { ActionForm, ActionSubmitButton } from "@/components/action-feedback";
import { PageHeading } from "@/components/page-heading";
import { PriceChart } from "@/components/price-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { requireUser } from "@/lib/auth/guards";
import { getCardTraderBlueprintUrl } from "@/lib/cardtrader/links";
import {
  CARD_CONDITIONS,
  EU_EEA_COUNTRY_CODES,
  SUPPORTED_LANGUAGE_CODES,
  SUPPORTED_LANGUAGE_LABELS,
} from "@/lib/constants";
import { formatEuro } from "@/lib/utils";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const watchId = (await params).id;
  const [row] = await getDb()
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
    .where(and(eq(watches.id, watchId), eq(watches.userId, user.id)))
    .limit(1);
  if (!row) notFound();
  const history = await getDb()
    .select()
    .from(priceObservations)
    .where(eq(priceObservations.watchId, watchId))
    .orderBy(asc(priceObservations.bucketAt));
  const candidate = row.metric?.candidate;

  return (
    <>
      <PageHeading
        eyebrow={row.expansion.name}
        title={row.card.name}
        description={[
          row.card.version,
          row.card.collectorNumber,
          row.card.rarity,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <ActionForm action={scanWatchAction}>
            <input type="hidden" name="watchId" value={watchId} />
            <ActionSubmitButton variant="outline" pendingLabel="Scanning…">
              <RefreshCw className="size-4" /> Scan now
            </ActionSubmitButton>
          </ActionForm>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <CardArt
          src={row.card.imageUrl}
          alt={row.card.name}
          sizes="(max-width: 1023px) 100vw, 220px"
          className="aspect-[0.716]"
        />
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Lowest"
              value={formatEuro(row.metric?.bestPriceCents)}
            />
            <Stat
              label="Reference"
              value={formatEuro(row.metric?.referencePriceCents)}
            />
            <Stat
              label="Discount"
              value={
                row.metric?.discountBps != null
                  ? `${(row.metric.discountBps / 100).toFixed(1)}%`
                  : "—"
              }
            />
            <Stat
              label="Listings"
              value={String(row.metric?.eligibleCount ?? "—")}
            />
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>30-day price history</CardTitle>
                {row.metric?.confidence ? (
                  <Badge
                    variant={
                      row.metric.confidence === "high" ? "success" : "warning"
                    }
                  >
                    {row.metric.confidence} confidence
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              <PriceChart
                data={history.map((point) => ({
                  at: point.bucketAt.toISOString(),
                  best: point.bestPriceCents,
                  baseline: point.currentBaselineCents,
                }))}
              />
            </CardContent>
          </Card>
          {candidate ? (
            <Card>
              <CardHeader>
                <CardTitle>Current candidate</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <Stat label="Seller" value={candidate.seller.username} />
                <Stat
                  label="Country"
                  value={candidate.seller.countryCode ?? "Unknown"}
                />
                <Stat label="Listing ID" value={String(candidate.productId)} />
                <p className="text-xs text-slate-500 sm:col-span-3">
                  {candidate.condition} · {candidate.language} ·{" "}
                  {candidate.foil ? "foil" : "non-foil"} · shipping excluded
                </p>
                <Button asChild className="sm:col-span-3">
                  <Link
                    href={getCardTraderBlueprintUrl(row.card.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open CardTrader <ExternalLink className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Watch filters</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm
                action={updateWatchAction}
                className="grid gap-6 sm:grid-cols-2"
              >
                <input type="hidden" name="watchId" value={watchId} />
                <input type="hidden" name="blueprintId" value={row.card.id} />
                <fieldset>
                  <legend className="mb-3 text-sm font-medium">
                    Languages
                  </legend>
                  <div className="flex flex-wrap gap-4">
                    {SUPPORTED_LANGUAGE_CODES.map((value) => (
                      <Checkbox
                        key={value}
                        name="languages"
                        value={value}
                        label={SUPPORTED_LANGUAGE_LABELS[value]}
                        defaultChecked={row.watch.languages.includes(value)}
                        containerClassName="text-xs"
                      />
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-3 text-sm font-medium">
                    Condition
                  </legend>
                  <div className="flex flex-wrap gap-4">
                    {CARD_CONDITIONS.map((condition) => (
                      <Checkbox
                        key={condition}
                        name="conditions"
                        value={condition}
                        label={condition}
                        defaultChecked={row.watch.conditions.includes(
                          condition,
                        )}
                        containerClassName="text-xs"
                      />
                    ))}
                  </div>
                </fieldset>
                <div>
                  <label
                    htmlFor="foil"
                    className="mb-2 block text-sm font-medium"
                  >
                    Foil
                  </label>
                  <Select
                    name="foil"
                    defaultValue={
                      row.watch.foil === null
                        ? "any"
                        : row.watch.foil
                          ? "foil"
                          : "nonfoil"
                    }
                  >
                    <SelectTrigger id="foil">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Foil or non-foil</SelectItem>
                      <SelectItem value="foil">Foil only</SelectItem>
                      <SelectItem value="nonfoil">Non-foil only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap items-center gap-5 pt-7">
                  <Checkbox
                    name="requireZero"
                    value="on"
                    label="CardTrader Zero only"
                    defaultChecked={row.watch.requireZero}
                    containerClassName="text-xs"
                  />
                  <Checkbox
                    name="graded"
                    value="on"
                    label="Graded"
                    defaultChecked={row.watch.graded}
                    containerClassName="text-xs"
                  />
                </div>
                <div>
                  <label
                    htmlFor="discountPercent"
                    className="mb-2 block text-sm font-medium"
                  >
                    Minimum discount (%)
                  </label>
                  <Input
                    id="discountPercent"
                    name="discountPercent"
                    type="number"
                    min="1"
                    max="90"
                    defaultValue={row.watch.discountPercent}
                  />
                </div>
                <div>
                  <label
                    htmlFor="minSavingsEuros"
                    className="mb-2 block text-sm font-medium"
                  >
                    Minimum saving (EUR)
                  </label>
                  <Input
                    id="minSavingsEuros"
                    name="minSavingsEuros"
                    type="number"
                    min="0"
                    step="0.5"
                    defaultValue={row.watch.minSavingsCents / 100}
                  />
                </div>
                <fieldset className="sm:col-span-2">
                  <legend className="mb-2 text-sm font-medium">
                    Seller country override
                  </legend>
                  <p className="mb-3 text-xs text-slate-500">
                    Leave every country unchecked to inherit account settings.
                  </p>
                  <div className="grid max-h-48 grid-cols-5 gap-2 overflow-auto rounded-xl border p-3 sm:grid-cols-10">
                    {EU_EEA_COUNTRY_CODES.map((country) => (
                      <Checkbox
                        key={country}
                        name="sellerCountries"
                        value={country}
                        label={country}
                        defaultChecked={row.watch.sellerCountries?.includes(
                          country,
                        )}
                        containerClassName="text-xs"
                      />
                    ))}
                  </div>
                </fieldset>
                <ActionSubmitButton
                  className="sm:col-span-2"
                  pendingLabel="Saving…"
                >
                  Save filters
                </ActionSubmitButton>
              </ActionForm>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white/[0.03] p-4">
      <p className="text-[11px] tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-2 truncate font-medium">{value}</p>
    </div>
  );
}
