-- Add new moderation actions for muting profiles
ALTER TYPE "moderation_action" ADD VALUE 'mute_profile';
ALTER TYPE "moderation_action" ADD VALUE 'unmute_profile';

-- Add mute-related columns to profile table
ALTER TABLE "profile" ADD COLUMN "muted_at" timestamp with time zone;
ALTER TABLE "profile" ADD COLUMN "muted_by_id" uuid;

-- Add foreign key constraint for muted_by_id
ALTER TABLE "profile" ADD CONSTRAINT "profile_muted_by_id_fkey" FOREIGN KEY ("muted_by_id") REFERENCES "profile"("id") ON DELETE no action ON UPDATE no action;
