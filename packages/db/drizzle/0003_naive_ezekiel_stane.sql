CREATE INDEX "yt_comments_video_like_published_idx" ON "yt_comments" USING btree ("video_id","like_count","published_at");--> statement-breakpoint
CREATE INDEX "yt_videos_channel_published_at_idx" ON "yt_videos" USING btree ("channel_id","published_at");
