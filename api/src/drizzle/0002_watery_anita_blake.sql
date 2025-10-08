CREATE INDEX IF NOT EXISTS "idx_post_content_search" ON "post" USING GIN (to_tsvector('simple', "content"));--> statement-breakpoint
ALTER TABLE "community" ADD COLUMN "mute_new_members" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "muted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "muted_by_id" uuid;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_muted_by_id_fkey" FOREIGN KEY ("muted_by_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;