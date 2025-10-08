-- Add mute_new_members column to community table
ALTER TABLE "community" ADD COLUMN "mute_new_members" boolean DEFAULT false NOT NULL;
