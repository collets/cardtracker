import "server-only";

import { getDb } from "@/db";
import { adminAuditEvents, adminAuditActionEnum } from "@/db/schema";

export type AdminAuditAction = (typeof adminAuditActionEnum.enumValues)[number];
export type AdminAuditMetadata = Record<
  string,
  string | number | boolean | null
>;

export async function recordAdminAudit(input: {
  actorUserId: string;
  action: AdminAuditAction;
  targetType: string;
  targetId?: string | null;
  outcome: "success" | "failure";
  metadata?: AdminAuditMetadata;
}) {
  await getDb()
    .insert(adminAuditEvents)
    .values({
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      outcome: input.outcome,
      metadata: input.metadata ?? {},
    });
}

export function safeFailureMetadata(error: unknown): AdminAuditMetadata {
  if (error instanceof Error) return { errorType: error.name.slice(0, 100) };
  return { errorType: "UnknownError" };
}
