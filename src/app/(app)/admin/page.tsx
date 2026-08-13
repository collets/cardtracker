import { and, count, countDistinct, desc, eq, gte, lt } from "drizzle-orm";
import Link from "next/link";
import {
  Database,
  MessageCircleMore,
  Play,
  RefreshCw,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  inviteUserAction,
  revokeGuestAccessLinkAction,
  revokePendingInvitationAction,
  runScannerAction,
  synchronizeCatalogAction,
  updateUserAction,
} from "@/app/(app)/admin/actions";
import { getDb } from "@/db";
import {
  alertFeedback,
  alerts,
  blueprints,
  guestAccessLinks,
  invitations,
  scanRuns,
  users,
  watches,
} from "@/db/schema";
import { PageHeading } from "@/components/page-heading";
import { AdminRunFilters } from "@/components/admin-run-filters";
import { GuestAccessManager } from "@/components/guest-access-manager";
import { ActionForm, ActionSubmitButton } from "@/components/action-feedback";
import { Badge } from "@/components/ui/badge";
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
import { requireAdmin } from "@/lib/auth/guards";
import {
  ALERT_FEEDBACK_OPTIONS,
  type AlertFeedbackOutcome,
} from "@/lib/alerts/feedback-options";

const RUNS_PER_PAGE = 20;

type RunSearchParams = {
  page?: string;
  kind?: string;
  status?: string;
  from?: string;
  to?: string;
};

const RUN_KINDS = ["catalog", "market", "cleanup"] as const;
const RUN_STATUSES = ["running", "succeeded", "failed"] as const;

function isOneOf<T extends readonly string[]>(
  value: string | undefined,
  choices: T,
): value is T[number] & string {
  return value !== undefined && choices.includes(value);
}

function parseDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? undefined
    : date;
}

function adminRunsHref(
  filters: Required<Pick<RunSearchParams, "kind" | "status" | "from" | "to">>,
  page: number,
) {
  const params = new URLSearchParams();
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<RunSearchParams>;
}) {
  await requireAdmin();
  const rawParams = await searchParams;
  const runKind = isOneOf(rawParams.kind, RUN_KINDS)
    ? rawParams.kind
    : undefined;
  const runStatus = isOneOf(rawParams.status, RUN_STATUSES)
    ? rawParams.status
    : undefined;
  const requestedFromDate = parseDate(rawParams.from);
  const requestedToDate = parseDate(rawParams.to);
  const hasInvalidDateRange = Boolean(
    requestedFromDate &&
    requestedToDate &&
    requestedFromDate.getTime() > requestedToDate.getTime(),
  );
  const runFilters = {
    kind: runKind ?? "",
    status: runStatus ?? "",
    from: requestedFromDate ? (rawParams.from ?? "") : "",
    to: requestedToDate ? (rawParams.to ?? "") : "",
  };
  const requestedPage = Number.parseInt(rawParams.page ?? "1", 10);
  const runPage = Number.isSafeInteger(requestedPage)
    ? Math.max(1, requestedPage)
    : 1;
  const runConditions = [
    runKind ? eq(scanRuns.kind, runKind) : undefined,
    runStatus ? eq(scanRuns.status, runStatus) : undefined,
    parseDate(runFilters.from) && !hasInvalidDateRange
      ? gte(scanRuns.startedAt, parseDate(runFilters.from)!)
      : undefined,
    parseDate(runFilters.to) && !hasInvalidDateRange
      ? lt(
          scanRuns.startedAt,
          new Date(parseDate(runFilters.to)!.getTime() + 86_400_000),
        )
      : undefined,
  ].filter(Boolean);
  const runWhere =
    runConditions.length > 0
      ? and(...(runConditions as NonNullable<(typeof runConditions)[number]>[]))
      : undefined;
  const [
    userRows,
    inviteRows,
    runRows,
    [catalogCount],
    [watchCount],
    [uniqueCount],
    [alertCount],
    feedbackRows,
    guestLinkRows,
    [runCount],
  ] = await Promise.all([
    getDb()
      .select()
      .from(users)
      .where(eq(users.kind, "member"))
      .orderBy(users.email),
    getDb().select().from(invitations).orderBy(desc(invitations.createdAt)),
    getDb()
      .select()
      .from(scanRuns)
      .where(runWhere)
      .orderBy(desc(scanRuns.startedAt))
      .limit(RUNS_PER_PAGE)
      .offset((runPage - 1) * RUNS_PER_PAGE),
    getDb().select({ value: count() }).from(blueprints),
    getDb()
      .select({ value: count() })
      .from(watches)
      .where(eq(watches.active, true)),
    getDb()
      .select({ value: countDistinct(watches.blueprintId) })
      .from(watches)
      .where(eq(watches.active, true)),
    getDb().select({ value: count() }).from(alerts),
    getDb()
      .select({ outcome: alertFeedback.outcome, value: count() })
      .from(alertFeedback)
      .groupBy(alertFeedback.outcome),
    getDb()
      .select()
      .from(guestAccessLinks)
      .orderBy(desc(guestAccessLinks.createdAt))
      .limit(10),
    getDb().select({ value: count() }).from(scanRuns).where(runWhere),
  ]);
  const runTotal = runCount?.value ?? 0;
  const runPageCount = Math.max(1, Math.ceil(runTotal / RUNS_PER_PAGE));
  const resolvedRunPage = Math.min(runPage, runPageCount);
  const visibleRunRows =
    resolvedRunPage === runPage
      ? runRows
      : await getDb()
          .select()
          .from(scanRuns)
          .where(runWhere)
          .orderBy(desc(scanRuns.startedAt))
          .limit(RUNS_PER_PAGE)
          .offset((resolvedRunPage - 1) * RUNS_PER_PAGE);
  const feedbackCounts = new Map<AlertFeedbackOutcome, number>(
    feedbackRows.map((row) => [row.outcome, row.value]),
  );
  const feedbackTotal = feedbackRows.reduce(
    (total, row) => total + row.value,
    0,
  );
  return (
    <>
      <PageHeading
        eyebrow="Operations"
        title="Administration"
        description="Invitations, capacity, catalog synchronization, and worker health."
        actions={
          <>
            <ActionForm action={synchronizeCatalogAction}>
              <ActionSubmitButton variant="outline" pendingLabel="Syncing…">
                <RefreshCw className="size-4" /> Sync catalog
              </ActionSubmitButton>
            </ActionForm>
            <ActionForm action={runScannerAction}>
              <ActionSubmitButton pendingLabel="Scanning…">
                <Play className="size-4" /> Run scanner
              </ActionSubmitButton>
            </ActionForm>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat
          icon={Database}
          label="Catalog"
          value={catalogCount?.value ?? 0}
        />
        <Stat
          icon={Play}
          label="Active watches"
          value={watchCount?.value ?? 0}
        />
        <Stat
          icon={RefreshCw}
          label="Unique blueprints"
          value={uniqueCount?.value ?? 0}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid gap-6 xl:h-[34rem] xl:grid-rows-2">
          <Card className="flex min-h-0 min-w-0 flex-col">
            <CardHeader>
              <CardTitle>Invite a user</CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col">
              <p className="mb-4 text-xs leading-5 text-slate-500">
                Invitations grant an email address access to Google sign-in. No
                invitation email is sent.
              </p>
              <ActionForm
                action={inviteUserAction}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <Input
                  name="email"
                  type="email"
                  placeholder="collector@example.com"
                  required
                />
                <Select name="role" defaultValue="user">
                  <SelectTrigger className="sm:w-32" aria-label="Role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <ActionSubmitButton pendingLabel="Inviting…">
                  <UserPlus className="size-4" /> Invite
                </ActionSubmitButton>
              </ActionForm>
              <div className="app-scrollbar mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {inviteRows.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-col items-stretch gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="min-w-0 truncate">{invite.email}</span>
                    <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                      <Badge variant={invite.acceptedAt ? "success" : "muted"}>
                        {invite.acceptedAt ? "accepted" : "pending"}
                      </Badge>
                      {!invite.acceptedAt ? (
                        <ActionForm action={revokePendingInvitationAction}>
                          <input
                            type="hidden"
                            name="invitationId"
                            value={invite.id}
                          />
                          <ActionSubmitButton
                            size="sm"
                            variant="destructive"
                            pendingLabel="Revoking…"
                            aria-label={`Revoke invitation for ${invite.email}`}
                          >
                            <Trash2 className="size-3.5" /> Revoke
                          </ActionSubmitButton>
                        </ActionForm>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="flex min-h-0 min-w-0 flex-col">
            <CardHeader>
              <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardContent className="app-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {userRows.map((user) => (
                <ActionForm
                  key={user.id}
                  action={updateUserAction}
                  className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_88px_auto] sm:items-center sm:gap-2"
                >
                  <input type="hidden" name="userId" value={user.id} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{user.email}</p>
                    <Select name="role" defaultValue={user.role}>
                      <SelectTrigger
                        className="mt-1 h-8 w-full border-white/10 bg-white/[0.03] px-2 text-xs sm:w-24"
                        aria-label={`Role for ${user.email}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label
                      className="text-[11px] font-medium text-slate-500 sm:sr-only"
                      htmlFor={`quota-${user.id}`}
                    >
                      Watch quota
                    </label>
                    <Input
                      id={`quota-${user.id}`}
                      name="quota"
                      type="number"
                      min="1"
                      max="500"
                      defaultValue={user.watchQuota}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-start">
                    <Checkbox
                      name="disabled"
                      label="Off"
                      defaultChecked={user.disabled}
                      containerClassName="text-xs text-slate-500"
                      className="checked:border-red-400 checked:bg-red-400"
                    />
                    <ActionSubmitButton
                      size="sm"
                      variant="outline"
                      pendingLabel="Saving…"
                    >
                      Save
                    </ActionSubmitButton>
                  </div>
                </ActionForm>
              ))}
            </CardContent>
          </Card>
        </div>
        <Card className="flex h-[34rem] min-w-0 flex-col">
          <CardHeader>
            <CardTitle>Guest demonstration access</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <GuestAccessManager />
            <div className="app-scrollbar mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {guestLinkRows.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No guest links created yet.
                </p>
              ) : (
                guestLinkRows.map((link) => {
                  const unavailable =
                    link.revokedAt !== null || link.expiresAt <= new Date();
                  const exhausted = link.usedCount >= link.maxUses;
                  return (
                    <div
                      key={link.id}
                      className="flex flex-col gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">
                          {link.usedCount}/{link.maxUses} visitor
                          {link.maxUses === 1 ? "" : "s"}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          Expires {link.expiresAt.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
                        <Badge
                          variant={
                            unavailable || exhausted ? "muted" : "success"
                          }
                        >
                          {link.revokedAt
                            ? "revoked"
                            : exhausted
                              ? "used"
                              : link.expiresAt <= new Date()
                                ? "expired"
                                : "active"}
                        </Badge>
                        {!unavailable && !exhausted ? (
                          <ActionForm action={revokeGuestAccessLinkAction}>
                            <input
                              type="hidden"
                              name="linkId"
                              value={link.id}
                            />
                            <ActionSubmitButton
                              size="sm"
                              variant="destructive"
                              pendingLabel="Revoking…"
                            >
                              <Trash2 className="size-3.5" /> Revoke
                            </ActionSubmitButton>
                          </ActionForm>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6" id="recent-runs">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Alert feedback</CardTitle>
              <p className="mt-2 text-sm text-slate-400">
                {feedbackTotal} of {alertCount?.value ?? 0} alerts rated. Each
                alert contributes its latest answer.
              </p>
            </div>
            <MessageCircleMore className="size-5 shrink-0 text-cyan-300" />
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ALERT_FEEDBACK_OPTIONS.map((option) => (
            <div
              key={option.value}
              className="rounded-xl border bg-white/[0.03] p-3"
            >
              <p className="text-xl font-semibold">
                {feedbackCounts.get(option.value) ?? 0}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                {option.label}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader className="space-y-4">
          <div>
            <CardTitle>Recent runs</CardTitle>
            <p className="mt-2 text-sm text-slate-400">
              {runTotal} matching run{runTotal === 1 ? "" : "s"} · newest first
            </p>
          </div>
          <AdminRunFilters initialFilters={runFilters} />
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="pb-3">Started</th>
                  <th className="pb-3">Kind</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Claimed</th>
                  <th className="pb-3">Failures</th>
                  <th className="pb-3">Error</th>
                </tr>
              </thead>
              <tbody>
                {visibleRunRows.length ? (
                  visibleRunRows.map((run) => (
                    <tr key={run.id} className="border-t">
                      <td className="py-3 pr-6">
                        {run.startedAt.toLocaleString()}
                      </td>
                      <td className="pr-6">{run.kind}</td>
                      <td className="pr-6">
                        <Badge
                          variant={
                            run.status === "succeeded"
                              ? "success"
                              : run.status === "failed"
                                ? "destructive"
                                : "warning"
                          }
                        >
                          {run.status}
                        </Badge>
                      </td>
                      <td className="pr-6">{run.claimedCount}</td>
                      <td className="pr-6">{run.failureCount}</td>
                      <td className="max-w-xs truncate text-slate-500">
                        {run.error ?? "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t">
                    <td className="py-8 text-center text-slate-500" colSpan={6}>
                      No runs match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-slate-400">
            <span>
              Page {resolvedRunPage} of {runPageCount}
            </span>
            <div className="flex gap-2">
              <Link
                href={adminRunsHref(runFilters, resolvedRunPage - 1)}
                scroll={false}
                aria-disabled={resolvedRunPage === 1}
                className="inline-flex h-8 items-center rounded-md border border-white/10 px-3 text-xs font-medium transition-colors hover:border-white/20 hover:bg-white/10 aria-disabled:pointer-events-none aria-disabled:opacity-40"
              >
                Previous
              </Link>
              <Link
                href={adminRunsHref(runFilters, resolvedRunPage + 1)}
                scroll={false}
                aria-disabled={resolvedRunPage === runPageCount}
                className="inline-flex h-8 items-center rounded-md border border-white/10 px-3 text-xs font-medium transition-colors hover:border-white/20 hover:bg-white/10 aria-disabled:pointer-events-none aria-disabled:opacity-40"
              >
                Next
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Database;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-white/[0.03] p-4">
      <Icon className="mb-3 size-4 text-cyan-300" />
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}
