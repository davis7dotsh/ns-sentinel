import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const channels = pgTable(
  "channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    ytChannelId: varchar("yt_channel_id", { length: 64 }).notNull().unique(),
    ytHandle: varchar("yt_handle", { length: 128 }),
    ytCustomUrl: text("yt_custom_url"),
    xUserId: varchar("x_user_id", { length: 64 }).unique(),
    xUsername: varchar("x_username", { length: 64 }),
    description: text("description"),
    avatarUrl: text("avatar_url"),
    bannerUrl: text("banner_url"),
    subscriberCount: bigint("subscriber_count", { mode: "bigint" }),
    totalViewCount: bigint("total_view_count", { mode: "bigint" }),
    videoCount: integer("video_count"),
    monthlyViewEstimate: bigint("monthly_view_estimate", { mode: "bigint" }),
    ytPublishedAt: timestamp("yt_published_at", { withTimezone: true }),
    lastYoutubeSyncedAt: timestamp("last_youtube_synced_at", {
      withTimezone: true,
    }),
    lastXSyncedAt: timestamp("last_x_synced_at", { withTimezone: true }),
    metadata: jsonb("metadata"),
    ...timestamps,
  },
  (table) => [index("channels_x_username_idx").on(table.xUsername)],
);

export const ytVideos = pgTable(
  "yt_videos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    ytVideoId: varchar("yt_video_id", { length: 32 }).notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    durationSeconds: integer("duration_seconds"),
    thumbnailUrl: text("thumbnail_url"),
    categoryId: varchar("category_id", { length: 16 }),
    defaultLanguage: varchar("default_language", { length: 16 }),
    contentKind: varchar("content_kind", { length: 32 }).default("video"),
    contentType: varchar("content_type", { length: 32 }),
    tags: jsonb("tags").$type<string[]>(),
    rawPayload: jsonb("raw_payload"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ...timestamps,
  },
  (table) => [
    index("yt_videos_channel_id_idx").on(table.channelId),
    index("yt_videos_published_at_idx").on(table.publishedAt),
    index("yt_videos_channel_published_at_idx").on(table.channelId, table.publishedAt),
  ],
);

export const ytVideoMetricsSnapshots = pgTable(
  "yt_video_metrics_snapshots",
  {
    videoId: uuid("video_id")
      .notNull()
      .references(() => ytVideos.id, { onDelete: "cascade" }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
    viewCount: bigint("view_count", { mode: "bigint" }),
    likeCount: bigint("like_count", { mode: "bigint" }),
    commentCount: bigint("comment_count", { mode: "bigint" }),
    rawPayload: jsonb("raw_payload"),
  },
  (table) => [
    primaryKey({ columns: [table.videoId, table.capturedAt] }),
    index("yt_video_metrics_captured_at_idx").on(table.capturedAt),
  ],
);

export const ytComments = pgTable(
  "yt_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => ytVideos.id, { onDelete: "cascade" }),
    ytCommentId: varchar("yt_comment_id", { length: 64 }).notNull().unique(),
    parentYtCommentId: varchar("parent_yt_comment_id", { length: 64 }),
    authorChannelId: varchar("author_channel_id", { length: 64 }),
    authorDisplayName: text("author_display_name"),
    bodyText: text("body_text").notNull(),
    likeCount: bigint("like_count", { mode: "bigint" }),
    replyCount: integer("reply_count"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    rawPayload: jsonb("raw_payload"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ...timestamps,
  },
  (table) => [
    index("yt_comments_video_id_idx").on(table.videoId),
    index("yt_comments_published_at_idx").on(table.publishedAt),
    index("yt_comments_video_like_published_idx").on(
      table.videoId,
      table.likeCount,
      table.publishedAt,
    ),
  ],
);

export const xPosts = pgTable(
  "x_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    xPostId: varchar("x_post_id", { length: 64 }).notNull().unique(),
    text: text("text").notNull(),
    lang: varchar("lang", { length: 16 }),
    conversationId: varchar("conversation_id", { length: 64 }),
    inReplyToXPostId: varchar("in_reply_to_x_post_id", { length: 64 }),
    quotedXPostId: varchar("quoted_x_post_id", { length: 64 }),
    repostedXPostId: varchar("reposted_x_post_id", { length: 64 }),
    mediaUrls: jsonb("media_urls").$type<string[]>(),
    externalUrls: jsonb("external_urls").$type<string[]>(),
    hashtags: jsonb("hashtags").$type<string[]>(),
    mentions: jsonb("mentions").$type<string[]>(),
    sourceCreatedAt: timestamp("source_created_at", {
      withTimezone: true,
    }).notNull(),
    rawPayload: jsonb("raw_payload"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ...timestamps,
  },
  (table) => [
    index("x_posts_channel_id_idx").on(table.channelId),
    index("x_posts_source_created_at_idx").on(table.sourceCreatedAt),
  ],
);

export const xPostMetricsSnapshots = pgTable(
  "x_post_metrics_snapshots",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => xPosts.id, { onDelete: "cascade" }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
    viewCount: bigint("view_count", { mode: "bigint" }),
    likeCount: bigint("like_count", { mode: "bigint" }),
    replyCount: bigint("reply_count", { mode: "bigint" }),
    repostCount: bigint("repost_count", { mode: "bigint" }),
    quoteCount: bigint("quote_count", { mode: "bigint" }),
    bookmarkCount: bigint("bookmark_count", { mode: "bigint" }),
    rawPayload: jsonb("raw_payload"),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.capturedAt] }),
    index("x_post_metrics_captured_at_idx").on(table.capturedAt),
  ],
);

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: varchar("source", { length: 32 }).notNull(),
    channelId: uuid("channel_id").references(() => channels.id, {
      onDelete: "set null",
    }),
    status: varchar("status", { length: 32 }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    cursor: text("cursor"),
    discoveredCount: integer("discovered_count"),
    insertedCount: integer("inserted_count"),
    updatedCount: integer("updated_count"),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata"),
    ...timestamps,
  },
  (table) => [
    index("sync_runs_channel_id_idx").on(table.channelId),
    index("sync_runs_source_status_idx").on(table.source, table.status),
  ],
);
