CREATE TYPE "public"."admin_audit_action" AS ENUM('invitation.create', 'invitation.revoke', 'user.update', 'catalog.synchronize', 'scanner.run');--> statement-breakpoint
CREATE TYPE "public"."audit_outcome" AS ENUM('success', 'failure');--> statement-breakpoint
CREATE ROLE "riftwatch_runtime";--> statement-breakpoint
ALTER ROLE "riftwatch_runtime" WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT;--> statement-breakpoint
CREATE TABLE "admin_audit_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_audit_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_user_id" uuid,
	"action" "admin_audit_action" NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"outcome" "audit_outcome" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_leases" (
	"name" text PRIMARY KEY NOT NULL,
	"lease_until" timestamp with time zone,
	"last_completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_leases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "alerts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "blueprint_scan_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "blueprints" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "expansions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "price_observations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scan_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "telegram_channels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "telegram_link_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "watch_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "watches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_audit_events" ADD CONSTRAINT "admin_audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_events_created_idx" ON "admin_audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_events_actor_idx" ON "admin_audit_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE POLICY "riftwatch runtime access" ON "accounts" AS PERMISSIVE FOR ALL TO "riftwatch_runtime" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "riftwatch runtime access" ON "alerts" AS PERMISSIVE FOR ALL TO "riftwatch_runtime" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "riftwatch runtime access" ON "blueprint_scan_state" AS PERMISSIVE FOR ALL TO "riftwatch_runtime" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "riftwatch runtime access" ON "blueprints" AS PERMISSIVE FOR ALL TO "riftwatch_runtime" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "riftwatch runtime access" ON "expansions" AS PERMISSIVE FOR ALL TO "riftwatch_runtime" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "riftwatch runtime access" ON "invitations" AS PERMISSIVE FOR ALL TO "riftwatch_runtime" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "riftwatch runtime access" ON "notification_deliveries" AS PERMISSIVE FOR ALL TO "riftwatch_runtime" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "riftwatch runtime access" ON "price_observations" AS PERMISSIVE FOR ALL TO "riftwatch_runtime" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "riftwatch runtime access" ON "scan_runs" AS PERMISSIVE FOR ALL TO "riftwatch_runtime" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "riftwatch runtime access" ON "sessions" AS PERMISSIVE FOR ALL TO "riftwatch_runtime" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "riftwatch runtime access" ON "telegram_channels" AS PERMISSIVE FOR ALL TO "riftwatch_runtime" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "riftwatch runtime access" ON "telegram_link_tokens" AS PERMISSIVE FOR ALL TO "riftwatch_runtime" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "riftwatch runtime access" ON "user_preferences" AS PERMISSIVE FOR ALL TO "riftwatch_runtime" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "riftwatch runtime access" ON "users" AS PERMISSIVE FOR ALL TO "riftwatch_runtime" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "riftwatch runtime access" ON "verification_tokens" AS PERMISSIVE FOR ALL TO "riftwatch_runtime" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "riftwatch runtime access" ON "watch_metrics" AS PERMISSIVE FOR ALL TO "riftwatch_runtime" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "riftwatch runtime access" ON "watches" AS PERMISSIVE FOR ALL TO "riftwatch_runtime" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "riftwatch runtime reads audit events" ON "admin_audit_events" AS PERMISSIVE FOR SELECT TO "riftwatch_runtime" USING (true);--> statement-breakpoint
CREATE POLICY "riftwatch runtime appends audit events" ON "admin_audit_events" AS PERMISSIVE FOR INSERT TO "riftwatch_runtime" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "riftwatch runtime access" ON "job_leases" AS PERMISSIVE FOR ALL TO "riftwatch_runtime" USING (true) WITH CHECK (true);--> statement-breakpoint

ALTER TABLE "accounts" FORCE ROW LEVEL SECURITY;
ALTER TABLE "admin_audit_events" FORCE ROW LEVEL SECURITY;
ALTER TABLE "alerts" FORCE ROW LEVEL SECURITY;
ALTER TABLE "blueprint_scan_state" FORCE ROW LEVEL SECURITY;
ALTER TABLE "blueprints" FORCE ROW LEVEL SECURITY;
ALTER TABLE "expansions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "invitations" FORCE ROW LEVEL SECURITY;
ALTER TABLE "job_leases" FORCE ROW LEVEL SECURITY;
ALTER TABLE "notification_deliveries" FORCE ROW LEVEL SECURITY;
ALTER TABLE "price_observations" FORCE ROW LEVEL SECURITY;
ALTER TABLE "scan_runs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "telegram_channels" FORCE ROW LEVEL SECURITY;
ALTER TABLE "telegram_link_tokens" FORCE ROW LEVEL SECURITY;
ALTER TABLE "user_preferences" FORCE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
ALTER TABLE "verification_tokens" FORCE ROW LEVEL SECURITY;
ALTER TABLE "watch_metrics" FORCE ROW LEVEL SECURITY;
ALTER TABLE "watches" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

REVOKE ALL ON SCHEMA "public" FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "public" FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;--> statement-breakpoint

DO $security$
DECLARE
	api_role text;
BEGIN
	FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
	LOOP
		IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
			EXECUTE format('REVOKE ALL ON SCHEMA public FROM %I', api_role);
			EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', api_role);
			EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', api_role);
			EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', api_role);
			EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', api_role);
			EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', api_role);
			EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %I', api_role);
		END IF;
	END LOOP;
END
$security$;--> statement-breakpoint

GRANT USAGE ON SCHEMA "public" TO "riftwatch_runtime";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "accounts", "admin_audit_events", "alerts", "blueprint_scan_state", "blueprints", "expansions", "invitations", "job_leases", "notification_deliveries", "price_observations", "scan_runs", "sessions", "telegram_channels", "telegram_link_tokens", "user_preferences", "users", "verification_tokens", "watch_metrics", "watches" TO "riftwatch_runtime";
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "admin_audit_events" FROM "riftwatch_runtime";
GRANT SELECT, INSERT ON TABLE "admin_audit_events" TO "riftwatch_runtime";
GRANT USAGE, SELECT ON SEQUENCE "admin_audit_events_id_seq", "price_observations_id_seq" TO "riftwatch_runtime";
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "riftwatch_runtime";
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" GRANT USAGE, SELECT ON SEQUENCES TO "riftwatch_runtime";--> statement-breakpoint

UPDATE "accounts"
SET
	"refresh_token" = NULL,
	"access_token" = NULL,
	"expires_at" = NULL,
	"token_type" = NULL,
	"scope" = NULL,
	"id_token" = NULL,
	"session_state" = NULL;
