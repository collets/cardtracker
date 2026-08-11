import { eq } from "drizzle-orm";
import { ExternalLink, Unplug } from "lucide-react";
import {
  createTelegramLinkAction,
  disconnectTelegramAction,
  savePreferencesAction,
} from "@/app/(app)/actions";
import { getDb } from "@/db";
import { telegramChannels, userPreferences, users } from "@/db/schema";
import { PageHeading } from "@/components/page-heading";
import { ActionForm, ActionSubmitButton } from "@/components/action-feedback";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { requireUser } from "@/lib/auth/guards";
import {
  CARD_CONDITIONS,
  DEFAULT_CONDITIONS,
  EU_EEA_COUNTRY_CODES,
  SUPPORTED_LANGUAGE_CODES,
} from "@/lib/constants";

export default async function SettingsPage() {
  const sessionUser = await requireUser();
  const [account, preferences, telegram] = await Promise.all([
    getDb()
      .select()
      .from(users)
      .where(eq(users.id, sessionUser.id))
      .limit(1)
      .then((rows) => rows[0]),
    getDb()
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, sessionUser.id))
      .limit(1)
      .then((rows) => rows[0]),
    getDb()
      .select()
      .from(telegramChannels)
      .where(eq(telegramChannels.userId, sessionUser.id))
      .limit(1)
      .then((rows) => rows[0]),
  ]);
  return (
    <>
      <PageHeading
        eyebrow="Account"
        title="Settings"
        description={`${account?.email ?? sessionUser.email} · ${account?.watchQuota ?? 50} watch quota`}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Marketplace defaults</CardTitle>
            <CardDescription>
              New watches inherit these values. Existing watches keep their
              card-specific filters, while a blank country override follows this
              setting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={savePreferencesAction} className="space-y-6">
              <div>
                <Label>Seller countries</Label>
                <div className="mt-3 grid max-h-56 grid-cols-3 gap-2 overflow-auto rounded-xl border p-3 sm:grid-cols-4">
                  {EU_EEA_COUNTRY_CODES.map((country) => (
                    <Checkbox
                      key={country}
                      name="sellerCountries"
                      value={country}
                      label={country}
                      defaultChecked={(
                        preferences?.sellerCountries ?? [
                          ...EU_EEA_COUNTRY_CODES,
                        ]
                      ).includes(country)}
                      containerClassName="text-xs"
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label>Languages</Label>
                <div className="mt-3 flex flex-wrap gap-5">
                  {SUPPORTED_LANGUAGE_CODES.map((value) => (
                    <Checkbox
                      key={value}
                      name="languages"
                      value={value}
                      defaultChecked={(
                        preferences?.languages ?? ["en"]
                      ).includes(value)}
                      label={
                        {
                          en: "English",
                          fr: "French",
                          kr: "Korean",
                          "zh-CN": "Chinese",
                        }[value]
                      }
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label>Conditions</Label>
                <div className="mt-3 flex flex-wrap gap-4">
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
              </div>
              <Checkbox
                name="requireZero"
                label="Require CardTrader Zero by default"
                defaultChecked={preferences?.requireZero}
              />
              <ActionSubmitButton pendingLabel="Saving…">
                Save defaults
              </ActionSubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Telegram alerts</CardTitle>
                <CardDescription className="mt-2">
                  Connect a private chat to receive actionable deal
                  notifications.
                </CardDescription>
              </div>
              {telegram ? (
                <Badge variant="success">Connected</Badge>
              ) : (
                <Badge variant="muted">Not connected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {telegram ? (
              <div>
                <p className="text-sm text-slate-300">
                  Linked to{" "}
                  {telegram.username
                    ? `@${telegram.username}`
                    : `chat ${telegram.chatId}`}
                  .
                </p>
                <ActionForm action={disconnectTelegramAction} className="mt-5">
                  <ActionSubmitButton
                    variant="outline"
                    pendingLabel="Disconnecting…"
                  >
                    <Unplug className="size-4" /> Disconnect
                  </ActionSubmitButton>
                </ActionForm>
              </div>
            ) : (
              <form action={createTelegramLinkAction}>
                <ActionSubmitButton pendingLabel="Opening…">
                  Open Telegram bot <ExternalLink className="size-4" />
                </ActionSubmitButton>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  The secure connection link expires after ten minutes and can
                  be used only once.
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
