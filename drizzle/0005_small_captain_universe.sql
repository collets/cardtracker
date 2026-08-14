CREATE TYPE "public"."recommendation_status" AS ENUM('pending', 'applied', 'dismissed', 'stale');--> statement-breakpoint
CREATE TABLE "threshold_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"watch_id" uuid NOT NULL,
	"status" "recommendation_status" DEFAULT 'pending' NOT NULL,
	"current_discount_percent" integer NOT NULL,
	"current_min_savings_cents" integer NOT NULL,
	"proposed_discount_percent" integer NOT NULL,
	"proposed_min_savings_cents" integer NOT NULL,
	"reference_price_cents" integer NOT NULL,
	"eligible_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "threshold_recommendations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ALTER COLUMN "alert_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "recommendation_id" uuid;--> statement-breakpoint
ALTER TABLE "threshold_recommendations" ADD CONSTRAINT "threshold_recommendations_watch_id_watches_id_fk" FOREIGN KEY ("watch_id") REFERENCES "public"."watches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "threshold_recommendations_watch_unique" ON "threshold_recommendations" USING btree ("watch_id");--> statement-breakpoint
CREATE INDEX "threshold_recommendations_status_created_idx" ON "threshold_recommendations" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_recommendation_id_threshold_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."threshold_recommendations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_deliveries_alert_idx" ON "notification_deliveries" USING btree ("alert_id");--> statement-breakpoint
CREATE INDEX "notification_deliveries_recommendation_idx" ON "notification_deliveries" USING btree ("recommendation_id");--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_one_source_check" CHECK (num_nonnulls("notification_deliveries"."alert_id", "notification_deliveries"."recommendation_id") = 1);
