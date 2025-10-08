-- Add full-text search index on post.content for efficient search queries
-- Using 'simple' configuration for better multilingual support (Korean, English, etc.)
CREATE INDEX IF NOT EXISTS "idx_post_content_search" ON "post" USING GIN (to_tsvector('simple', "content"));--> statement-breakpoint
DO $$ BEGIN
 ALTER TYPE "public"."moderation_action" ADD VALUE IF NOT EXISTS 'mute_profile';
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TYPE "public"."moderation_action" ADD VALUE IF NOT EXISTS 'unmute_profile';
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community" ADD COLUMN IF NOT EXISTS "mute_new_members" boolean DEFAULT false NOT NULL;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile" ADD COLUMN IF NOT EXISTS "muted_at" timestamp with time zone;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile" ADD COLUMN IF NOT EXISTS "muted_by_id" uuid;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile" ADD CONSTRAINT "profile_muted_by_id_fkey" FOREIGN KEY ("muted_by_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;