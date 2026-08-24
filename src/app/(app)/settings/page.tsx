import { eq } from "drizzle-orm";
import { ExternalLink, Unplug } from "lucide-react";
import {
  createTelegramLinkAction,
  disconnectTelegramAction,
  savePreferencesAction,
  saveTelegramDiagnosticsAction,
} from "@/app/(app)/actions";
import { getDb } from "@/db";
import { telegramChannels, userPreferences } from "@/db/schema";
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
  SUPPORTED_LANGUAGE_LABELS,
} from "@/lib/constants";

export default async function AccountPage() {
  const sessionUser = await requireUser();
  const [preferences, telegram] = await Promise.all([
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
        title="Account"
        description={
          sessionUser.kind === "guest"
            ? "Guest demonstration access · 2-watch quota"
            : `${sessionUser.email} · ${sessionUser.watchQuota} watch quota`
        }
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
                      label={SUPPORTED_LANGUAGE_LABELS[value]}
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
            {sessionUser.kind === "guest" ? (
              <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.04] p-4 text-sm leading-6 text-slate-300">
                Telegram alerts are available to full Riftwatch accounts. Guest
                access keeps the demo focused on the in-app alert experience and
                expires automatically after one hour.
              </div>
            ) : telegram ? (
              <div className="space-y-5">
                <p className="text-sm text-slate-300">
                  Linked to{" "}
                  {telegram.username
                    ? `@${telegram.username}`
                    : `chat ${telegram.chatId}`}
                  .
                </p>
                {sessionUser.role === "admin" ? (
                  <ActionForm
                    action={saveTelegramDiagnosticsAction}
                    className="space-y-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4"
                  >
                    <Checkbox
                      name="diagnosticsEnabled"
                      label="Scheduled scan diagnostics"
                      defaultChecked={telegram.diagnosticsEnabled}
                    />
                    <p className="text-xs leading-5 text-slate-400">
                      Send one compact Telegram heartbeat after every scheduled
                      scan, including zero-work runs. At a five-minute cadence
                      this is intentionally noisy; manual scans stay quiet.
                    </p>
                    <ActionSubmitButton
                      size="sm"
                      variant="outline"
                      pendingLabel="Saving…"
                    >
                      Save diagnostics
                    </ActionSubmitButton>
                  </ActionForm>
                ) : null}
                <ActionForm action={disconnectTelegramAction}>
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
