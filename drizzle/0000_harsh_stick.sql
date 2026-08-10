CREATE TYPE "public"."alert_state" AS ENUM('active', 'expired', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."confidence" AS ENUM('medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."run_kind" AS ENUM('catalog', 'market', 'cleanup');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"watch_id" uuid NOT NULL,
	"product_id" bigint NOT NULL,
	"state" "alert_state" DEFAULT 'active' NOT NULL,
	"candidate_price_cents" integer NOT NULL,
	"reference_price_cents" integer NOT NULL,
	"discount_bps" integer NOT NULL,
	"confidence" "confidence" NOT NULL,
	"miss_count" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_notified_at" timestamp with time zone,
	"last_notified_price_cents" integer,
	"read_at" timestamp with time zone,
	"expired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "blueprint_scan_state" (
	"blueprint_id" integer PRIMARY KEY NOT NULL,
	"next_scan_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_scan_at" timestamp with time zone,
	"lease_until" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "blueprints" (
	"id" integer PRIMARY KEY NOT NULL,
	"expansion_id" integer NOT NULL,
	"game_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"name" text NOT NULL,
	"version" text,
	"collector_number" text,
	"rarity" text,
	"image_url" text,
	"fixed_properties" jsonb NOT NULL,
	"editable_properties" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expansions" (
	"id" integer PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"invited_by" uuid,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "price_observations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "price_observations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"watch_id" uuid NOT NULL,
	"bucket_at" timestamp with time zone NOT NULL,
	"best_price_cents" integer,
	"current_baseline_cents" integer,
	"eligible_count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "run_kind" NOT NULL,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"claimed_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_channels" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"username" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_channels_chat_id_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
CREATE TABLE "telegram_link_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"seller_countries" text[] DEFAULT ARRAY['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE']::text[] NOT NULL,
	"languages" text[] DEFAULT ARRAY['en']::text[] NOT NULL,
	"conditions" text[] DEFAULT ARRAY['Mint', 'Near Mint']::text[] NOT NULL,
	"require_zero" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"watch_quota" integer DEFAULT 50 NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "watch_metrics" (
	"watch_id" uuid PRIMARY KEY NOT NULL,
	"best_product_id" bigint,
	"best_price_cents" integer,
	"current_baseline_cents" integer,
	"historical_baseline_cents" integer,
	"reference_price_cents" integer,
	"eligible_count" integer DEFAULT 0 NOT NULL,
	"discount_bps" integer,
	"confidence" "confidence",
	"qualifies" boolean DEFAULT false NOT NULL,
	"rejection_reason" text,
	"scanned_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"languages" text[] DEFAULT ARRAY['en']::text[] NOT NULL,
	"conditions" text[] DEFAULT ARRAY['Mint', 'Near Mint']::text[] NOT NULL,
	"foil" boolean,
	"graded" boolean DEFAULT false NOT NULL,
	"require_zero" boolean DEFAULT false NOT NULL,
	"seller_countries" text[],
	"discount_percent" integer DEFAULT 20 NOT NULL,
	"min_savings_cents" integer DEFAULT 500 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_watch_id_watches_id_fk" FOREIGN KEY ("watch_id") REFERENCES "public"."watches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_scan_state" ADD CONSTRAINT "blueprint_scan_state_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprints" ADD CONSTRAINT "blueprints_expansion_id_expansions_id_fk" FOREIGN KEY ("expansion_id") REFERENCES "public"."expansions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_watch_id_watches_id_fk" FOREIGN KEY ("watch_id") REFERENCES "public"."watches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_channels" ADD CONSTRAINT "telegram_channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_link_tokens" ADD CONSTRAINT "telegram_link_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_metrics" ADD CONSTRAINT "watch_metrics_watch_id_watches_id_fk" FOREIGN KEY ("watch_id") REFERENCES "public"."watches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watches" ADD CONSTRAINT "watches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watches" ADD CONSTRAINT "watches_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_watch_product_unique" ON "alerts" USING btree ("watch_id","product_id");--> statement-breakpoint
CREATE INDEX "alerts_watch_state_idx" ON "alerts" USING btree ("watch_id","state");--> statement-breakpoint
CREATE INDEX "blueprints_expansion_idx" ON "blueprints" USING btree ("expansion_id");--> statement-breakpoint
CREATE INDEX "blueprints_name_idx" ON "blueprints" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_email_unique" ON "invitations" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "notification_delivery_dedupe_unique" ON "notification_deliveries" USING btree ("dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "price_observations_watch_bucket_unique" ON "price_observations" USING btree ("watch_id","bucket_at");--> statement-breakpoint
CREATE INDEX "price_observations_bucket_idx" ON "price_observations" USING btree ("bucket_at");--> statement-breakpoint
CREATE INDEX "scan_runs_started_idx" ON "scan_runs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_link_token_hash_unique" ON "telegram_link_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "watches_user_idx" ON "watches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "watches_blueprint_idx" ON "watches" USING btree ("blueprint_id");