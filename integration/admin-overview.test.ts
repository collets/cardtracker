import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, getSql } from "@/db";
import {
  guestAccessLinks,
  invitations,
  scanRuns,
  telegramChannels,
  users,
} from "@/db/schema";
import { loadAdminOverview } from "@/lib/admin/overview";

const userId = "00000000-0000-4000-8000-000000000961";
const invitationId = "00000000-0000-4000-8000-000000000962";
const guestLinkId = "00000000-0000-4000-8000-000000000963";
const runId = "00000000-0000-4000-8000-000000000964";

async function cleanFixtures() {
  await getDb()
    .delete(guestAccessLinks)
    .where(eq(guestAccessLinks.id, guestLinkId));
  await getDb().delete(invitations).where(eq(invitations.id, invitationId));
  await getDb().delete(scanRuns).where(eq(scanRuns.id, runId));
  await getDb().delete(users).where(eq(users.id, userId));
}

beforeEach(async () => {
  await cleanFixtures();
  await getDb().insert(users).values({
    id: userId,
    email: "admin-overview-integration@riftwatch.test",
    role: "user",
    watchQuota: 12,
  });
  await getDb().insert(telegramChannels).values({
    userId,
    chatId: "admin-overview-integration-chat",
    diagnosticsEnabled: true,
  });
  await getDb().insert(invitations).values({
    id: invitationId,
    email: "admin-overview-invite@riftwatch.test",
    invitedBy: userId,
  });
  await getDb()
    .insert(guestAccessLinks)
    .values({
      id: guestLinkId,
      tokenHash: "admin-overview-integration-token-hash",
      maxUses: 2,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      createdBy: userId,
    });
  await getDb().insert(scanRuns).values({
    id: runId,
    kind: "market",
    status: "succeeded",
    claimedCount: 3,
  });
});

afterAll(async () => {
  await cleanFixtures();
  await getSql().end();
});

describe("admin overview loading", () => {
  it("loads the overview through one bounded read transaction", async () => {
    const overview = await loadAdminOverview({
      requestedPage: 1,
      runWhere: eq(scanRuns.id, runId),
    });

    expect(overview.userRows).toContainEqual(
      expect.objectContaining({
        id: userId,
        watchQuota: 12,
        telegramDiagnosticsEnabled: true,
      }),
    );
    expect(overview.inviteRows).toContainEqual(
      expect.objectContaining({ id: invitationId }),
    );
    expect(overview.guestLinkRows).toContainEqual(
      expect.objectContaining({ id: guestLinkId, maxUses: 2 }),
    );
    expect(overview.runRows).toEqual([
      expect.objectContaining({ id: runId, claimedCount: 3 }),
    ]);
    expect(overview).toMatchObject({
      runTotal: 1,
      runPageCount: 1,
      resolvedRunPage: 1,
    });
  });
});
