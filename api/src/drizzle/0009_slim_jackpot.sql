-- Create deletion_reason enum
CREATE TYPE "public"."deletion_reason" AS ENUM('author', 'cascade');--> statement-breakpoint

-- Add deletion_reason columns to board_post (nullable)
ALTER TABLE "board_post" ADD COLUMN "deletion_reason" "deletion_reason";--> statement-breakpoint

-- Add deletion_reason columns to board_post_reply (nullable)
ALTER TABLE "board_post_reply" ADD COLUMN "deletion_reason" "deletion_reason";--> statement-breakpoint

-- Backfill existing deleted board_post records with 'author'
UPDATE "board_post" SET "deletion_reason" = 'author' WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

-- Backfill existing deleted board_post_reply records with 'author'
UPDATE "board_post_reply" SET "deletion_reason" = 'author' WHERE "deleted_at" IS NOT NULL;
