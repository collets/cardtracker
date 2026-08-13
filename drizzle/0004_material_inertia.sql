CREATE TYPE "public"."user_kind" AS ENUM('member', 'guest');--> statement-breakpoint
CREATE TABLE "guest_access_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"max_uses" integer NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest_access_redemptions" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"link_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kind" "user_kind" DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_access_links" ADD CONSTRAINT "guest_access_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_access_redemptions" ADD CONSTRAINT "guest_access_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_access_redemptions" ADD CONSTRAINT "guest_access_redemptions_link_id_guest_access_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."guest_access_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "guest_access_links_token_hash_unique" ON "guest_access_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "guest_access_links_active_idx" ON "guest_access_links" USING btree ("expires_at","revoked_at");--> statement-breakpoint
CREATE INDEX "guest_access_redemptions_expiry_idx" ON "guest_access_redemptions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "guest_access_redemptions_link_idx" ON "guest_access_redemptions" USING btree ("link_id");