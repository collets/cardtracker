import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  alerts,
  blueprints,
  notificationDeliveries,
  telegramChannels,
  telegramLinkTokens,
  watches,
} from "@/db/schema";
import { getCardTraderBlueprintUrl } from "@/lib/cardtrader/links";
import { getServerEnv, requireEnv } from "@/lib/env";
import { formatEuro } from "@/lib/utils";

const telegramUpdateSchema = z.object({
  message: z
    .object({
      text: z.string().optional(),
      chat: z.object({
        id: z.union([z.string(), z.number()]),
        username: z.string().optional(),
      }),
    })
    .optional(),
});

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createTelegramLink(userId: string) {
  const botUsername = requireEnv("TELEGRAM_BOT_USERNAME");
  const token = randomBytes(24).toString("base64url");
  await getDb()
    .insert(telegramLinkTokens)
    .values({
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
  return `https://t.me/${botUsername}?start=${token}`;
}

export async function disconnectTelegram(userId: string) {
  await getDb()
    .delete(telegramChannels)
    .where(eq(telegramChannels.userId, userId));
}

export async function handleTelegramUpdate(
  input: unknown,
  fetchImpl: typeof fetch = fetch,
) {
  const update = telegramUpdateSchema.parse(input);
  const message = update.message;
  if (!message?.text?.startsWith("/start ")) return { handled: false };
  const token = message.text.slice(7).trim();
  const [link] = await getDb()
    .select()
    .from(telegramLinkTokens)
    .where(
      and(
        eq(telegramLinkTokens.tokenHash, hashToken(token)),
        gt(telegramLinkTokens.expiresAt, new Date()),
        isNull(telegramLinkTokens.usedAt),
      ),
    )
    .limit(1);
  if (!link) return { handled: false };

  await getDb().transaction(async (tx) => {
    await tx
      .insert(telegramChannels)
      .values({
        userId: link.userId,
        chatId: String(message.chat.id),
        username: message.chat.username ?? null,
      })
      .onConflictDoUpdate({
        target: telegramChannels.userId,
        set: {
          chatId: String(message.chat.id),
          username: message.chat.username ?? null,
          enabled: true,
          linkedAt: new Date(),
        },
      });
    await tx
      .update(telegramLinkTokens)
      .set({ usedAt: new Date() })
      .where(eq(telegramLinkTokens.id, link.id));
  });
  await sendTelegramMessage(
    String(message.chat.id),
    "Riftwatch is connected. Deal alerts will arrive here.",
    fetchImpl,
  );
  return { handled: true };
}

export async function queueTelegramDelivery(
  alertId: string,
  notificationTime: Date,
) {
  const [row] = await getDb()
    .select({ channel: telegramChannels.chatId })
    .from(alerts)
    .innerJoin(watches, eq(watches.id, alerts.watchId))
    .innerJoin(
      telegramChannels,
      and(
        eq(telegramChannels.userId, watches.userId),
        eq(telegramChannels.enabled, true),
      ),
    )
    .where(eq(alerts.id, alertId))
    .limit(1);
  if (!row) return;
  await getDb()
    .insert(notificationDeliveries)
    .values({
      alertId,
      channel: "telegram",
      dedupeKey: `telegram:${alertId}:${notificationTime.toISOString()}`,
    })
    .onConflictDoNothing();
}

async function sendTelegramMessage(
  chatId: string,
  text: string,
  fetchImpl: typeof fetch,
  cardTraderUrl?: string,
) {
  const token = requireEnv("TELEGRAM_BOT_TOKEN");
  const response = await fetchImpl(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
        ...(cardTraderUrl
          ? {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "Open CardTrader", url: cardTraderUrl }],
                ],
              },
            }
          : {}),
      }),
      cache: "no-store",
    },
  );
  if (!response.ok)
    throw new Error(`Telegram delivery failed with HTTP ${response.status}`);
}

export async function dispatchPendingNotifications(
  fetchImpl: typeof fetch = fetch,
  options: { deliveryIds?: string[] } = {},
) {
  const env = getServerEnv();
  if (!env.TELEGRAM_BOT_TOKEN) return { sent: 0, failed: 0 };

  const deliveries = await getDb()
    .select({
      delivery: notificationDeliveries,
      alert: alerts,
      blueprintId: blueprints.id,
      cardName: blueprints.name,
      cardVersion: blueprints.version,
      chatId: telegramChannels.chatId,
    })
    .from(notificationDeliveries)
    .innerJoin(alerts, eq(alerts.id, notificationDeliveries.alertId))
    .innerJoin(watches, eq(watches.id, alerts.watchId))
    .innerJoin(blueprints, eq(blueprints.id, watches.blueprintId))
    .innerJoin(telegramChannels, eq(telegramChannels.userId, watches.userId))
    .where(
      and(
        inArray(notificationDeliveries.status, ["pending", "failed"]),
        lt(notificationDeliveries.attempts, 3),
        eq(telegramChannels.enabled, true),
        options.deliveryIds?.length
          ? inArray(notificationDeliveries.id, options.deliveryIds)
          : undefined,
      ),
    )
    .orderBy(asc(notificationDeliveries.createdAt))
    .limit(25);

  let sent = 0;
  let failed = 0;
  for (const row of deliveries) {
    const discount = (row.alert.discountBps / 100).toFixed(1);
    const title = row.cardVersion
      ? `${row.cardName} · ${row.cardVersion}`
      : row.cardName;
    const text = [
      `Riftwatch deal: ${title}`,
      `${formatEuro(row.alert.candidatePriceCents)} vs ${formatEuro(row.alert.referencePriceCents)} reference`,
      `${discount}% below market · ${row.alert.confidence} confidence`,
      `Seller: ${row.alert.candidate.seller.username} (${row.alert.candidate.seller.countryCode ?? "unknown"})`,
      `Listing ID: ${row.alert.productId}`,
      `${env.NEXT_PUBLIC_APP_URL}/alerts`,
    ].join("\n");
    try {
      await sendTelegramMessage(
        row.chatId,
        text,
        fetchImpl,
        getCardTraderBlueprintUrl(row.blueprintId),
      );
      await getDb()
        .update(notificationDeliveries)
        .set({
          status: "sent",
          sentAt: new Date(),
          attempts: sql`${notificationDeliveries.attempts} + 1`,
          lastError: null,
        })
        .where(eq(notificationDeliveries.id, row.delivery.id));
      sent += 1;
    } catch (error) {
      await getDb()
        .update(notificationDeliveries)
        .set({
          status: "failed",
          attempts: sql`${notificationDeliveries.attempts} + 1`,
          lastError:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "Telegram error",
        })
        .where(eq(notificationDeliveries.id, row.delivery.id));
      failed += 1;
    }
  }
  return { sent, failed };
}
