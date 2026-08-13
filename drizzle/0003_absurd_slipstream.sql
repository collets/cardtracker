DROP INDEX "alerts_watch_product_unique";--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "alerts_watch_product_last_seen_idx" ON "alerts" USING btree ("watch_id","product_id","last_seen_at");