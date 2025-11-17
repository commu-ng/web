CREATE TYPE "public"."device_platform" AS ENUM('ios', 'android');--> statement-breakpoint
CREATE TABLE "device" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"push_token" text NOT NULL,
	"platform" "device_platform" NOT NULL,
	"user_id" uuid NOT NULL,
	"device_model" text,
	"os_version" text,
	"app_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_push_token_key" UNIQUE("push_token")
);
--> statement-breakpoint
ALTER TABLE "board_post" ALTER COLUMN "deletion_reason" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "board_post_reply" ALTER COLUMN "deletion_reason" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "device" ADD CONSTRAINT "device_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_device_user_id" ON "device" USING btree ("user_id");