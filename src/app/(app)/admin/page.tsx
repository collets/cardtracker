import { count, countDistinct, desc, eq } from "drizzle-orm";
import { Database, Play, RefreshCw, Trash2, UserPlus } from "lucide-react";
import {
  deletePendingInvitationAction,
  inviteUserAction,
  runScannerAction,
  synchronizeCatalogAction,
  updateUserAction,
} from "@/app/(app)/admin/actions";
import { getDb } from "@/db";
import {
  adminAuditEvents,
  blueprints,
  invitations,
  scanRuns,
  users,
  watches,
} from "@/db/schema";
import { PageHeading } from "@/components/page-heading";
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
import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminPage() {
  await requireAdmin();
  const [
    userRows,
    inviteRows,
    runRows,
    [catalogCount],
    [watchCount],
    [uniqueCount],
    auditRows,
  ] = await Promise.all([
    getDb().select().from(users).orderBy(users.email),
    getDb().select().from(invitations).orderBy(desc(invitations.createdAt)),
    getDb().select().from(scanRuns).orderBy(desc(scanRuns.startedAt)).limit(20),
    getDb().select({ value: count() }).from(blueprints),
    getDb()
      .select({ value: count() })
      .from(watches)
      .where(eq(watches.active, true)),
    getDb()
      .select({ value: countDistinct(watches.blueprintId) })
      .from(watches)
      .where(eq(watches.active, true)),
    getDb()
      .select({ event: adminAuditEvents, actorEmail: users.email })
      .from(adminAuditEvents)
      .leftJoin(users, eq(users.id, adminAuditEvents.actorUserId))
      .orderBy(desc(adminAuditEvents.createdAt))
      .limit(50),
  ]);
  return (
    <>
      <PageHeading
        eyebrow="Operations"
        title="Administration"
        description="Invitations, capacity, catalog synchronization, and worker health."
        actions={
          <>
            <form action={synchronizeCatalogAction}>
              <Button type="submit" variant="outline">
                <RefreshCw className="size-4" /> Sync catalog
              </Button>
            </form>
            <form action={runScannerAction}>
              <Button type="submit">
                <Play className="size-4" /> Run scanner
              </Button>
            </form>
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
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Invite a user</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-xs leading-5 text-slate-500">
              Invitations grant an email address access to Google sign-in. No
              invitation email is sent.
            </p>
            <form
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
              <Button type="submit">
                <UserPlus className="size-4" /> Invite
              </Button>
            </form>
            <div className="mt-5 space-y-2">
              {inviteRows.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">{invite.email}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={invite.acceptedAt ? "success" : "muted"}>
                      {invite.acceptedAt ? "accepted" : "pending"}
                    </Badge>
                    {!invite.acceptedAt ? (
                      <form action={deletePendingInvitationAction}>
                        <input
                          type="hidden"
                          name="invitationId"
                          value={invite.id}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          variant="destructive"
                          aria-label={`Delete invitation for ${invite.email}`}
                        >
                          <Trash2 className="size-3.5" /> Delete
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {userRows.map((user) => (
              <form
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
                  <Button type="submit" size="sm" variant="outline">
                    Save
                  </Button>
                </div>
              </form>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] text-left text-sm">
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
                {runRows.map((run) => (
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
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Administrator audit trail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] text-left text-sm">
              <thead className="text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="pb-3">Time</th>
                  <th className="pb-3">Actor</th>
                  <th className="pb-3">Action</th>
                  <th className="pb-3">Target</th>
                  <th className="pb-3">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map(({ event, actorEmail }) => (
                  <tr key={event.id} className="border-t">
                    <td className="py-3 pr-6">
                      {event.createdAt.toLocaleString()}
                    </td>
                    <td className="max-w-48 truncate pr-6">
                      {actorEmail ?? "Deleted user"}
                    </td>
                    <td className="pr-6">{event.action}</td>
                    <td className="max-w-52 truncate pr-6 text-slate-400">
                      {event.targetType}
                      {event.targetId ? ` · ${event.targetId}` : ""}
                    </td>
                    <td>
                      <Badge
                        variant={
                          event.outcome === "success"
                            ? "success"
                            : "destructive"
                        }
                      >
                        {event.outcome}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
