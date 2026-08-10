DROP INDEX "invitations_email_unique";--> statement-breakpoint
DROP INDEX "users_email_unique";--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "candidate" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "watch_metrics" ADD COLUMN "candidate" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_email_unique" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");