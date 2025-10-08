CREATE TYPE "public"."application_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."community_role" AS ENUM('owner', 'moderator', 'member');--> statement-breakpoint
CREATE TYPE "public"."export_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."moderation_action" AS ENUM('delete_post');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('reply', 'mention', 'reaction');--> statement-breakpoint
CREATE TYPE "public"."profile_ownership_role" AS ENUM('owner', 'admin');--> statement-breakpoint
CREATE TABLE "account_deletion_token" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"token" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "account_deletion_token_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "application_attachment" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"application_id" uuid NOT NULL,
	"image_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"is_recruiting" boolean NOT NULL,
	"recruiting_starts_at" timestamp with time zone,
	"recruiting_ends_at" timestamp with time zone,
	"minimum_birth_year" integer,
	"custom_domain" text,
	"domain_verified_at" timestamp with time zone,
	"description" text,
	CONSTRAINT "community_slug_key" UNIQUE("slug"),
	CONSTRAINT "community_custom_domain_key" UNIQUE("custom_domain")
);
--> statement-breakpoint
CREATE TABLE "community_application" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"message" text,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"community_id" uuid NOT NULL,
	"reviewed_by_id" uuid,
	"rejection_reason" text,
	"profile_name" text NOT NULL,
	"profile_username" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_banner_image" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"community_id" uuid NOT NULL,
	"image_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "community_description_image" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"community_id" uuid NOT NULL,
	"image_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "community_export" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"community_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "export_status" DEFAULT 'pending' NOT NULL,
	"r2_key" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "community_hashtag" (
	"community_id" uuid NOT NULL,
	"hashtag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_hashtag_pkey" PRIMARY KEY("community_id","hashtag_id")
);
--> statement-breakpoint
CREATE TABLE "community_link" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"community_id" uuid NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "direct_message" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"community_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"receiver_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"read_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "direct_message_image" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"message_id" uuid NOT NULL,
	"image_id" uuid NOT NULL,
	CONSTRAINT "unique_direct_message_image" UNIQUE("message_id","image_id")
);
--> statement-breakpoint
CREATE TABLE "direct_message_reaction" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"profile_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	CONSTRAINT "unique_direct_message_reaction" UNIQUE("message_id","profile_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "email_verification_token" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"token" uuid NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "email_verification_token_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "exchange_token" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"token" uuid NOT NULL,
	"target_domain" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "exchange_token_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "group_chat" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"community_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_chat_membership" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"group_chat_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"added_by_id" uuid,
	CONSTRAINT "unique_group_chat_membership" UNIQUE("group_chat_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "group_chat_message" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"group_chat_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_chat_message_image" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"message_id" uuid NOT NULL,
	"image_id" uuid NOT NULL,
	CONSTRAINT "unique_group_chat_message_image" UNIQUE("message_id","image_id")
);
--> statement-breakpoint
CREATE TABLE "group_chat_message_reaction" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"profile_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	CONSTRAINT "unique_group_chat_message_reaction" UNIQUE("message_id","profile_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "group_chat_message_read" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"message_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"read_at" timestamp with time zone NOT NULL,
	CONSTRAINT "unique_message_read" UNIQUE("message_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "hashtag" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hashtag_tag_key" UNIQUE("tag")
);
--> statement-breakpoint
CREATE TABLE "image" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"filename" text NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "membership" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"community_id" uuid NOT NULL,
	"role" "community_role" NOT NULL,
	"activated_at" timestamp with time zone,
	"application_id" uuid,
	CONSTRAINT "unique_user_community_membership" UNIQUE("user_id","community_id"),
	CONSTRAINT "unique_membership_application" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "mention" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"profile_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	CONSTRAINT "unique_mention" UNIQUE("profile_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "moderation_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"action" "moderation_action" NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"moderator_id" uuid NOT NULL,
	"target_user_id" uuid,
	"target_profile_id" uuid,
	"target_post_id" uuid,
	"extra_data" text
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"post_id" uuid,
	"read_at" timestamp with time zone,
	"direct_message_id" uuid
);
--> statement-breakpoint
CREATE TABLE "password_reset_token" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"token" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "password_reset_token_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "post" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"announcement" boolean DEFAULT false NOT NULL,
	"author_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"community_id" uuid NOT NULL,
	"in_reply_to_id" uuid,
	"depth" integer DEFAULT 0 NOT NULL,
	"root_post_id" uuid,
	"content_warning" text,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "post_bookmark" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"profile_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	CONSTRAINT "unique_profile_post_bookmark" UNIQUE("profile_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "post_image" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"post_id" uuid NOT NULL,
	"image_id" uuid NOT NULL,
	CONSTRAINT "unique_post_image" UNIQUE("post_id","image_id")
);
--> statement-breakpoint
CREATE TABLE "post_reaction" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"profile_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	CONSTRAINT "unique_post_reaction" UNIQUE("post_id","profile_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"community_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"bio" text,
	"activated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "unique_username_community" UNIQUE("username","community_id")
);
--> statement-breakpoint
CREATE TABLE "profile_ownership" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"profile_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "profile_ownership_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	CONSTRAINT "unique_profile_user_ownership" UNIQUE("profile_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "profile_picture" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"profile_id" uuid NOT NULL,
	"image_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"token" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_id" uuid NOT NULL,
	"community_id" uuid,
	CONSTRAINT "session_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"login_name" text NOT NULL,
	"email" text,
	"email_verified_at" timestamp with time zone,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"is_admin" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_login_name_key" UNIQUE("login_name"),
	CONSTRAINT "user_email_key" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "account_deletion_token" ADD CONSTRAINT "account_deletion_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_attachment" ADD CONSTRAINT "application_attachment_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."community_application"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_attachment" ADD CONSTRAINT "application_attachment_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."image"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_application" ADD CONSTRAINT "community_application_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_application" ADD CONSTRAINT "community_application_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_application" ADD CONSTRAINT "community_application_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_banner_image" ADD CONSTRAINT "community_banner_image_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_banner_image" ADD CONSTRAINT "community_banner_image_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."image"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_description_image" ADD CONSTRAINT "community_description_image_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_description_image" ADD CONSTRAINT "community_description_image_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."image"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_export" ADD CONSTRAINT "community_export_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_export" ADD CONSTRAINT "community_export_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_hashtag" ADD CONSTRAINT "community_hashtag_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_hashtag" ADD CONSTRAINT "community_hashtag_hashtag_id_fkey" FOREIGN KEY ("hashtag_id") REFERENCES "public"."hashtag"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_link" ADD CONSTRAINT "community_link_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_message" ADD CONSTRAINT "message_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_message" ADD CONSTRAINT "message_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_message" ADD CONSTRAINT "message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_message" ADD CONSTRAINT "direct_message_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_message_image" ADD CONSTRAINT "direct_message_image_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."image"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_message_image" ADD CONSTRAINT "direct_message_image_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."direct_message"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_message_reaction" ADD CONSTRAINT "direct_message_reaction_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_message_reaction" ADD CONSTRAINT "direct_message_reaction_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."direct_message"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_token" ADD CONSTRAINT "email_verification_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_token" ADD CONSTRAINT "exchange_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_chat" ADD CONSTRAINT "group_chat_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_chat" ADD CONSTRAINT "group_chat_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_chat_membership" ADD CONSTRAINT "group_chat_membership_group_chat_id_fkey" FOREIGN KEY ("group_chat_id") REFERENCES "public"."group_chat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_chat_membership" ADD CONSTRAINT "group_chat_membership_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_chat_membership" ADD CONSTRAINT "group_chat_membership_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_chat_message" ADD CONSTRAINT "group_chat_message_group_chat_id_fkey" FOREIGN KEY ("group_chat_id") REFERENCES "public"."group_chat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_chat_message" ADD CONSTRAINT "group_chat_message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_chat_message" ADD CONSTRAINT "group_chat_message_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_chat_message_image" ADD CONSTRAINT "group_chat_message_image_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."image"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_chat_message_image" ADD CONSTRAINT "group_chat_message_image_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."group_chat_message"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_chat_message_reaction" ADD CONSTRAINT "group_chat_message_reaction_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_chat_message_reaction" ADD CONSTRAINT "group_chat_message_reaction_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."group_chat_message"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_chat_message_read" ADD CONSTRAINT "group_chat_message_read_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."group_chat_message"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_chat_message_read" ADD CONSTRAINT "group_chat_message_read_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."community_application"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mention" ADD CONSTRAINT "mention_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mention" ADD CONSTRAINT "mention_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_target_profile_id_fkey" FOREIGN KEY ("target_profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_target_post_id_fkey" FOREIGN KEY ("target_post_id") REFERENCES "public"."post"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_direct_message_id_fkey" FOREIGN KEY ("direct_message_id") REFERENCES "public"."direct_message"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_token" ADD CONSTRAINT "password_reset_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_in_reply_to_id_fkey" FOREIGN KEY ("in_reply_to_id") REFERENCES "public"."post"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "fk_post_root_post_id" FOREIGN KEY ("root_post_id") REFERENCES "public"."post"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_bookmark" ADD CONSTRAINT "post_bookmark_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_bookmark" ADD CONSTRAINT "post_bookmark_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_image" ADD CONSTRAINT "post_image_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."image"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_image" ADD CONSTRAINT "post_image_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reaction" ADD CONSTRAINT "post_reaction_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reaction" ADD CONSTRAINT "post_reaction_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_ownership" ADD CONSTRAINT "profile_ownership_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_ownership" ADD CONSTRAINT "profile_ownership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_ownership" ADD CONSTRAINT "profile_ownership_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_picture" ADD CONSTRAINT "profile_picture_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_picture" ADD CONSTRAINT "profile_picture_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."image"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_unique_pending_application" ON "community_application" USING btree ("user_id","community_id") WHERE "community_application"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "community_export_community_id_idx" ON "community_export" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "community_export_user_id_idx" ON "community_export" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "community_export_status_idx" ON "community_export" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_direct_message_conversation" ON "direct_message" USING btree ("sender_id","receiver_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_direct_message_unread" ON "direct_message" USING btree ("receiver_id","read_at");--> statement-breakpoint
CREATE INDEX "idx_exchange_token_expires_at" ON "exchange_token" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_group_chat_message_history" ON "group_chat_message" USING btree ("group_chat_id","created_at");--> statement-breakpoint
CREATE INDEX "hashtag_tag_lower_idx" ON "hashtag" USING btree (LOWER("tag"));--> statement-breakpoint
CREATE INDEX "idx_membership_community_active" ON "membership" USING btree ("community_id","activated_at");--> statement-breakpoint
CREATE INDEX "idx_membership_user_community_active" ON "membership" USING btree ("user_id","community_id","activated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_one_active_owner_per_community" ON "membership" USING btree ("community_id") WHERE "membership"."role" = 'owner' AND "membership"."activated_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_notification_unread" ON "notification" USING btree ("recipient_id","read_at");--> statement-breakpoint
CREATE INDEX "idx_password_reset_token_expires_at" ON "password_reset_token" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_post_depth" ON "post" USING btree ("depth" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_post_in_reply_to_id_created" ON "post" USING btree ("in_reply_to_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_post_root_post_id_created" ON "post" USING btree ("root_post_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_post_community_id_created" ON "post" USING btree ("community_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_post_scheduled_at" ON "post" USING btree ("scheduled_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_post_bookmark_profile_id_created" ON "post_bookmark" USING btree ("profile_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_profile_ownership_user_id" ON "profile_ownership" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_profile_ownership_profile_id" ON "profile_ownership" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_session_expires_at" ON "session" USING btree ("expires_at");