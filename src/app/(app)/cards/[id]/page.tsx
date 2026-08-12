import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { addWatchAction } from "@/app/(app)/actions";
import { getDb } from "@/db";
import { blueprints, expansions, userPreferences } from "@/db/schema";
import { CardArt } from "@/components/card-art";
import { ActionSubmitButton } from "@/components/action-feedback";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { requireUser } from "@/lib/auth/guards";
import {
  CARD_CONDITIONS,
  DEFAULT_CONDITIONS,
  SUPPORTED_LANGUAGE_CODES,
  SUPPORTED_LANGUAGE_LABELS,
} from "@/lib/constants";

export default async function CardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const id = Number((await params).id);
  const [row] = await getDb()
    .select({ card: blueprints, expansion: expansions })
    .from(blueprints)
    .innerJoin(expansions, eq(expansions.id, blueprints.expansionId))
    .where(eq(blueprints.id, id))
    .limit(1);
  if (!row) notFound();
  const [preferences] = await getDb()
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, user.id))
    .limit(1);

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
      />
      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        <CardArt
          src={row.card.imageUrl}
          alt={row.card.name}
          sizes="(max-width: 1023px) 100vw, 300px"
          className="aspect-[0.716]"
        />
        <Card>
          <CardHeader>
            <CardTitle>Track this printing</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addWatchAction} className="grid gap-6 sm:grid-cols-2">
              <input type="hidden" name="blueprintId" value={row.card.id} />
              <fieldset>
                <legend className="mb-3 text-sm font-medium">Languages</legend>
                <div className="flex flex-wrap gap-4">
                  {SUPPORTED_LANGUAGE_CODES.map((value) => (
                    <Checkbox
                      key={value}
                      name="languages"
                      value={value}
                      label={SUPPORTED_LANGUAGE_LABELS[value]}
                      defaultChecked={(
                        preferences?.languages ?? ["en"]
                      ).includes(value)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-3 text-sm font-medium">Condition</legend>
                <div className="flex flex-wrap gap-4">
                  {CARD_CONDITIONS.map((condition) => (
                    <Checkbox
                      key={condition}
                      name="conditions"
                      value={condition}
                      label={condition}
                      defaultChecked={(
                        preferences?.conditions ?? DEFAULT_CONDITIONS
                      ).includes(condition)}
                    />
                  ))}
                </div>
              </fieldset>
              <div className="space-y-2">
                <Label htmlFor="foil">Foil</Label>
                <Select name="foil" defaultValue="any">
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
              <div className="space-y-2">
                <Label>Marketplace options</Label>
                <div className="flex flex-wrap gap-4 pt-2">
                  <Checkbox
                    name="requireZero"
                    value="on"
                    label="CardTrader Zero only"
                    defaultChecked={preferences?.requireZero}
                  />
                  <Checkbox name="graded" value="on" label="Graded" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountPercent">Minimum discount</Label>
                <div className="relative">
                  <Input
                    id="discountPercent"
                    name="discountPercent"
                    type="number"
                    min="1"
                    max="90"
                    defaultValue="20"
                  />
                  <span className="absolute top-2 right-3 text-sm text-slate-500">
                    %
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minSavingsEuros">Minimum saving</Label>
                <div className="relative">
                  <Input
                    id="minSavingsEuros"
                    name="minSavingsEuros"
                    type="number"
                    min="0"
                    step="0.5"
                    defaultValue="5"
                  />
                  <span className="absolute top-2 right-3 text-sm text-slate-500">
                    EUR
                  </span>
                </div>
              </div>
              <p className="text-xs leading-5 text-slate-500 sm:col-span-2">
                Seller countries inherit your account preference. Signed,
                altered, risky, and unavailable listings are always excluded.
                Shipping is not included.
              </p>
              <ActionSubmitButton
                className="sm:col-span-2"
                pendingLabel="Adding…"
              >
                Add to watchlist
              </ActionSubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
