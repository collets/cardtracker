CREATE TYPE "public"."alert_feedback_outcome" AS ENUM('purchased', 'useful', 'unavailable', 'not_a_deal', 'wrong_details', 'shipping_too_expensive');--> statement-breakpoint
CREATE TABLE "alert_feedback" (
	"alert_id" uuid PRIMARY KEY NOT NULL,
	"outcome" "alert_feedback_outcome" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "alert_feedback" ADD CONSTRAINT "alert_feedback_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_feedback_outcome_updated_idx" ON "alert_feedback" USING btree ("outcome","updated_at");
