CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"yt_channel_id" varchar(64) NOT NULL,
	"yt_handle" varchar(128),
	"yt_custom_url" text,
	"x_user_id" varchar(64),
	"x_username" varchar(64),
	"description" text,
	"avatar_url" text,
	"banner_url" text,
	"subscriber_count" bigint,
	"total_view_count" bigint,
	"video_count" integer,
	"monthly_view_estimate" bigint,
	"yt_published_at" timestamp with time zone,
	"last_youtube_synced_at" timestamp with time zone,
	"last_x_synced_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channels_yt_channel_id_unique" UNIQUE("yt_channel_id"),
	CONSTRAINT "channels_x_user_id_unique" UNIQUE("x_user_id")
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(32) NOT NULL,
	"channel_id" uuid,
	"status" varchar(32) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"cursor" text,
	"discovered_count" integer,
	"inserted_count" integer,
	"updated_count" integer,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "x_post_metrics_snapshots" (
	"post_id" uuid NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"view_count" bigint,
	"like_count" bigint,
	"reply_count" bigint,
	"repost_count" bigint,
	"quote_count" bigint,
	"bookmark_count" bigint,
	"raw_payload" jsonb,
	CONSTRAINT "x_post_metrics_snapshots_post_id_captured_at_pk" PRIMARY KEY("post_id","captured_at")
);
--> statement-breakpoint
CREATE TABLE "x_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"x_post_id" varchar(64) NOT NULL,
	"text" text NOT NULL,
	"lang" varchar(16),
	"conversation_id" varchar(64),
	"in_reply_to_x_post_id" varchar(64),
	"quoted_x_post_id" varchar(64),
	"reposted_x_post_id" varchar(64),
	"media_urls" jsonb,
	"external_urls" jsonb,
	"hashtags" jsonb,
	"mentions" jsonb,
	"source_created_at" timestamp with time zone NOT NULL,
	"raw_payload" jsonb,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "x_posts_x_post_id_unique" UNIQUE("x_post_id")
);
--> statement-breakpoint
CREATE TABLE "yt_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"yt_comment_id" varchar(64) NOT NULL,
	"parent_yt_comment_id" varchar(64),
	"author_channel_id" varchar(64),
	"author_display_name" text,
	"body_text" text NOT NULL,
	"like_count" bigint,
	"reply_count" integer,
	"published_at" timestamp with time zone NOT NULL,
	"source_updated_at" timestamp with time zone,
	"raw_payload" jsonb,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "yt_comments_yt_comment_id_unique" UNIQUE("yt_comment_id")
);
--> statement-breakpoint
CREATE TABLE "yt_video_metrics_snapshots" (
	"video_id" uuid NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"view_count" bigint,
	"like_count" bigint,
	"comment_count" bigint,
	"raw_payload" jsonb,
	CONSTRAINT "yt_video_metrics_snapshots_video_id_captured_at_pk" PRIMARY KEY("video_id","captured_at")
);
--> statement-breakpoint
CREATE TABLE "yt_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"yt_video_id" varchar(32) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"published_at" timestamp with time zone NOT NULL,
	"duration_seconds" integer,
	"thumbnail_url" text,
	"category_id" varchar(16),
	"default_language" varchar(16),
	"content_kind" varchar(32) DEFAULT 'video',
	"tags" jsonb,
	"raw_payload" jsonb,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "yt_videos_yt_video_id_unique" UNIQUE("yt_video_id")
);
--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_post_metrics_snapshots" ADD CONSTRAINT "x_post_metrics_snapshots_post_id_x_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."x_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_posts" ADD CONSTRAINT "x_posts_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yt_comments" ADD CONSTRAINT "yt_comments_video_id_yt_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."yt_videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yt_video_metrics_snapshots" ADD CONSTRAINT "yt_video_metrics_snapshots_video_id_yt_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."yt_videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yt_videos" ADD CONSTRAINT "yt_videos_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channels_x_username_idx" ON "channels" USING btree ("x_username");--> statement-breakpoint
CREATE INDEX "sync_runs_channel_id_idx" ON "sync_runs" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "sync_runs_source_status_idx" ON "sync_runs" USING btree ("source","status");--> statement-breakpoint
CREATE INDEX "x_post_metrics_captured_at_idx" ON "x_post_metrics_snapshots" USING btree ("captured_at");--> statement-breakpoint
CREATE INDEX "x_posts_channel_id_idx" ON "x_posts" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "x_posts_source_created_at_idx" ON "x_posts" USING btree ("source_created_at");--> statement-breakpoint
CREATE INDEX "yt_comments_video_id_idx" ON "yt_comments" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "yt_comments_published_at_idx" ON "yt_comments" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "yt_video_metrics_captured_at_idx" ON "yt_video_metrics_snapshots" USING btree ("captured_at");--> statement-breakpoint
CREATE INDEX "yt_videos_channel_id_idx" ON "yt_videos" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "yt_videos_published_at_idx" ON "yt_videos" USING btree ("published_at");