import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import type { MarketListing } from "@/lib/cardtrader/types";
import {
  DEFAULT_CONDITIONS,
  DEFAULT_DISCOUNT_PERCENT,
  DEFAULT_LANGUAGES,
  DEFAULT_MIN_SAVINGS_CENTS,
} from "@/lib/constants";

export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);
export const userKindEnum = pgEnum("user_kind", ["member", "guest"]);
export const runKindEnum = pgEnum("run_kind", ["catalog", "market", "cleanup"]);
export const runStatusEnum = pgEnum("run_status", [
  "running",
  "succeeded",
  "failed",
]);
export const confidenceEnum = pgEnum("confidence", ["medium", "high"]);
export const alertStateEnum = pgEnum("alert_state", [
  "active",
  "expired",
  "dismissed",
]);
export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending",
  "sent",
  "failed",
]);
export const alertFeedbackOutcomeEnum = pgEnum("alert_feedback_outcome", [
  "purchased",
  "useful",
  "unavailable",
  "not_a_deal",
  "wrong_details",
  "shipping_too_expensive",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name"),
    email: text("email").notNull(),
    emailVerified: timestamp("email_verified", {
      mode: "date",
      withTimezone: true,
    }),
    image: text("image"),
    role: userRoleEnum("role").notNull().default("user"),
    kind: userKindEnum("kind").notNull().default("member"),
    watchQuota: integer("watch_quota").notNull().default(50),
    disabled: boolean("disabled").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    role: userRoleEnum("role").notNull().default("user"),
    invitedBy: uuid("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("invitations_email_unique").on(table.email)],
);

export const guestAccessLinks = pgTable(
  "guest_access_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenHash: text("token_hash").notNull(),
    maxUses: integer("max_uses").notNull(),
    usedCount: integer("used_count").notNull().default(0),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("guest_access_links_token_hash_unique").on(table.tokenHash),
    index("guest_access_links_active_idx").on(table.expiresAt, table.revokedAt),
  ],
);

export const guestAccessRedemptions = pgTable(
  "guest_access_redemptions",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    linkId: uuid("link_id")
      .notNull()
      .references(() => guestAccessLinks.id),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("guest_access_redemptions_expiry_idx").on(table.expiresAt),
    index("guest_access_redemptions_link_idx").on(table.linkId),
  ],
);

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  sellerCountries: text("seller_countries")
    .array()
    .notNull()
    .default(
      sql`ARRAY['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE']::text[]`,
    ),
  languages: text("languages")
    .array()
    .notNull()
    .default(sql`ARRAY['en']::text[]`),
  conditions: text("conditions")
    .array()
    .notNull()
    .default(sql`ARRAY['Mint', 'Near Mint']::text[]`),
  requireZero: boolean("require_zero").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const expansions = pgTable("expansions", {
  id: integer("id").primaryKey(),
  gameId: integer("game_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  syncedAt: timestamp("synced_at", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
});

export const blueprints = pgTable(
  "blueprints",
  {
    id: integer("id").primaryKey(),
    expansionId: integer("expansion_id")
      .notNull()
      .references(() => expansions.id, { onDelete: "cascade" }),
    gameId: integer("game_id").notNull(),
    categoryId: integer("category_id").notNull(),
    name: text("name").notNull(),
    version: text("version"),
    collectorNumber: text("collector_number"),
    rarity: text("rarity"),
    imageUrl: text("image_url"),
    fixedProperties: jsonb("fixed_properties")
      .$type<Record<string, unknown>>()
      .notNull(),
    editableProperties: jsonb("editable_properties")
      .$type<unknown[]>()
      .notNull(),
    active: boolean("active").notNull().default(true),
    syncedAt: timestamp("synced_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    index("blueprints_expansion_idx").on(table.expansionId),
    index("blueprints_name_idx").on(table.name),
  ],
);

export const watches = pgTable(
  "watches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blueprintId: integer("blueprint_id")
      .notNull()
      .references(() => blueprints.id, { onDelete: "cascade" }),
    active: boolean("active").notNull().default(true),
    languages: text("languages")
      .array()
      .notNull()
      .default(sql`ARRAY['en']::text[]`),
    conditions: text("conditions")
      .array()
      .notNull()
      .default(sql`ARRAY['Mint', 'Near Mint']::text[]`),
    foil: boolean("foil"),
    graded: boolean("graded").notNull().default(false),
    requireZero: boolean("require_zero").notNull().default(false),
    sellerCountries: text("seller_countries").array(),
    discountPercent: integer("discount_percent")
      .notNull()
      .default(DEFAULT_DISCOUNT_PERCENT),
    minSavingsCents: integer("min_savings_cents")
      .notNull()
      .default(DEFAULT_MIN_SAVINGS_CENTS),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("watches_user_idx").on(table.userId),
    index("watches_blueprint_idx").on(table.blueprintId),
  ],
);

export const blueprintScanState = pgTable("blueprint_scan_state", {
  blueprintId: integer("blueprint_id")
    .primaryKey()
    .references(() => blueprints.id, { onDelete: "cascade" }),
  nextScanAt: timestamp("next_scan_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  lastScanAt: timestamp("last_scan_at", { mode: "date", withTimezone: true }),
  leaseUntil: timestamp("lease_until", { mode: "date", withTimezone: true }),
  failureCount: integer("failure_count").notNull().default(0),
  lastError: text("last_error"),
});

export const scanRuns = pgTable(
  "scan_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: runKindEnum("kind").notNull(),
    status: runStatusEnum("status").notNull().default("running"),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", {
      mode: "date",
      withTimezone: true,
    }),
    claimedCount: integer("claimed_count").notNull().default(0),
    successCount: integer("success_count").notNull().default(0),
    failureCount: integer("failure_count").notNull().default(0),
    details: jsonb("details")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    error: text("error"),
  },
  (table) => [index("scan_runs_started_idx").on(table.startedAt)],
);

export const watchMetrics = pgTable("watch_metrics", {
  watchId: uuid("watch_id")
    .primaryKey()
    .references(() => watches.id, { onDelete: "cascade" }),
  bestProductId: bigint("best_product_id", { mode: "number" }),
  candidate: jsonb("candidate").$type<MarketListing>(),
  bestPriceCents: integer("best_price_cents"),
  currentBaselineCents: integer("current_baseline_cents"),
  historicalBaselineCents: integer("historical_baseline_cents"),
  referencePriceCents: integer("reference_price_cents"),
  eligibleCount: integer("eligible_count").notNull().default(0),
  discountBps: integer("discount_bps"),
  confidence: confidenceEnum("confidence"),
  qualifies: boolean("qualifies").notNull().default(false),
  rejectionReason: text("rejection_reason"),
  scannedAt: timestamp("scanned_at", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
});

export const priceObservations = pgTable(
  "price_observations",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    watchId: uuid("watch_id")
      .notNull()
      .references(() => watches.id, { onDelete: "cascade" }),
    bucketAt: timestamp("bucket_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    bestPriceCents: integer("best_price_cents"),
    currentBaselineCents: integer("current_baseline_cents"),
    eligibleCount: integer("eligible_count").notNull(),
  },
  (table) => [
    uniqueIndex("price_observations_watch_bucket_unique").on(
      table.watchId,
      table.bucketAt,
    ),
    index("price_observations_bucket_idx").on(table.bucketAt),
  ],
);

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    watchId: uuid("watch_id")
      .notNull()
      .references(() => watches.id, { onDelete: "cascade" }),
    productId: bigint("product_id", { mode: "number" }).notNull(),
    candidate: jsonb("candidate").$type<MarketListing>().notNull(),
    state: alertStateEnum("state").notNull().default("active"),
    candidatePriceCents: integer("candidate_price_cents").notNull(),
    referencePriceCents: integer("reference_price_cents").notNull(),
    discountBps: integer("discount_bps").notNull(),
    confidence: confidenceEnum("confidence").notNull(),
    missCount: integer("miss_count").notNull().default(0),
    firstSeenAt: timestamp("first_seen_at", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    lastNotifiedAt: timestamp("last_notified_at", {
      mode: "date",
      withTimezone: true,
    }),
    lastNotifiedPriceCents: integer("last_notified_price_cents"),
    readAt: timestamp("read_at", { mode: "date", withTimezone: true }),
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
    expiredAt: timestamp("expired_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    index("alerts_watch_product_last_seen_idx").on(
      table.watchId,
      table.productId,
      table.lastSeenAt,
    ),
    index("alerts_watch_state_idx").on(table.watchId, table.state),
  ],
);

export const alertFeedback = pgTable(
  "alert_feedback",
  {
    alertId: uuid("alert_id")
      .primaryKey()
      .references(() => alerts.id, { onDelete: "cascade" }),
    outcome: alertFeedbackOutcomeEnum("outcome").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("alert_feedback_outcome_updated_idx").on(
      table.outcome,
      table.updatedAt,
    ),
  ],
);

export const telegramChannels = pgTable("telegram_channels", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  chatId: text("chat_id").notNull().unique(),
  username: text("username"),
  enabled: boolean("enabled").notNull().default(true),
  linkedAt: timestamp("linked_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const telegramLinkTokens = pgTable(
  "telegram_link_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    usedAt: timestamp("used_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("telegram_link_token_hash_unique").on(table.tokenHash),
  ],
);

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    alertId: uuid("alert_id")
      .notNull()
      .references(() => alerts.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    status: deliveryStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    uniqueIndex("notification_delivery_dedupe_unique").on(table.dedupeKey),
  ],
);

export const userRelations = relations(users, ({ many, one }) => ({
  watches: many(watches),
  preferences: one(userPreferences),
  telegramChannel: one(telegramChannels),
  guestAccessRedemption: one(guestAccessRedemptions),
}));

export const guestAccessLinkRelations = relations(
  guestAccessLinks,
  ({ many, one }) => ({
    createdByUser: one(users, {
      fields: [guestAccessLinks.createdBy],
      references: [users.id],
    }),
    redemptions: many(guestAccessRedemptions),
  }),
);

export const guestAccessRedemptionRelations = relations(
  guestAccessRedemptions,
  ({ one }) => ({
    user: one(users, {
      fields: [guestAccessRedemptions.userId],
      references: [users.id],
    }),
    link: one(guestAccessLinks, {
      fields: [guestAccessRedemptions.linkId],
      references: [guestAccessLinks.id],
    }),
  }),
);

export const blueprintRelations = relations(blueprints, ({ one, many }) => ({
  expansion: one(expansions, {
    fields: [blueprints.expansionId],
    references: [expansions.id],
  }),
  watches: many(watches),
}));

export const watchRelations = relations(watches, ({ one, many }) => ({
  user: one(users, { fields: [watches.userId], references: [users.id] }),
  blueprint: one(blueprints, {
    fields: [watches.blueprintId],
    references: [blueprints.id],
  }),
  metric: one(watchMetrics),
  observations: many(priceObservations),
  alerts: many(alerts),
}));

// These constants are imported so schema defaults and product defaults cannot drift.
void DEFAULT_LANGUAGES;
void DEFAULT_CONDITIONS;
