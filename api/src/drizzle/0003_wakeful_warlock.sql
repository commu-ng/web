ALTER TABLE "profile" ADD COLUMN "last_active_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "online_status_visible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_profile_last_active_at" ON "profile" USING btree ("last_active_at");