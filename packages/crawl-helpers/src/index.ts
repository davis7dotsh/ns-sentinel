import { eq, inArray, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { Effect } from "effect";
import { createSentinelError } from "@ns-sentinel/core";
import { Database, schema } from "@ns-sentinel/db";
import {
  type YoutubeChannelProfile,
  type YoutubeVideoBundle,
  type YoutubeVideoComment,
  YoutubeReader,
} from "@ns-sentinel/youtube-read";

const crawlHelpersModule = "@ns-sentinel/crawl-helpers";

type DatabaseClient = ReturnType<typeof drizzle>;

export type YoutubeSyncResult = {
  readonly channelId: string;
  readonly discoveredCount: number;
  readonly insertedCount: number;
  readonly updatedCount: number;
  readonly commentSyncedVideoCount: number;
};

export type YoutubeChannelSeedResult = {
  readonly channelId: string;
  readonly ytChannelId: string;
  readonly title: string;
};

const createCrawlHelpersError = (
  operation: string,
  message: string,
  cause?: unknown,
) =>
  createSentinelError({
    module: crawlHelpersModule,
    operation,
    message,
    cause,
  });

const parseBigIntValue = (value: string | number | bigint | undefined) => {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(value);
  }

  if (typeof value === "string" && value.length > 0) {
    return BigInt(value);
  }

  return undefined;
};

const parseDateValue = (value: string | undefined) =>
  value ? new Date(value) : undefined;

const parseYoutubeChannelInput = (input: string) => {
  const trimmed = input.trim();
  const channelIdMatch =
    /youtube\.com\/channel\/([A-Za-z0-9_-]+)/iu.exec(trimmed) ??
    /^(UC[A-Za-z0-9_-]{20,})$/u.exec(trimmed);
  const handleMatch =
    /youtube\.com\/@([A-Za-z0-9._-]+)/iu.exec(trimmed) ??
    /^@([A-Za-z0-9._-]+)$/u.exec(trimmed);

  return {
    original: trimmed,
    channelId: channelIdMatch?.[1],
    handle: handleMatch?.[1],
  };
};

const loadYoutubeChannelsFromDatabase = (db: DatabaseClient) =>
  db
    .select({
      id: schema.channels.id,
      ytChannelId: schema.channels.ytChannelId,
      name: schema.channels.name,
    })
    .from(schema.channels)
    .where(isNotNull(schema.channels.ytChannelId));

const findExistingYoutubeVideos = (
  db: DatabaseClient,
  ytVideoIds: readonly string[],
) =>
  ytVideoIds.length === 0
    ? Promise.resolve([] as Array<{ id: string; ytVideoId: string }>)
    : db
        .select({
          id: schema.ytVideos.id,
          ytVideoId: schema.ytVideos.ytVideoId,
        })
        .from(schema.ytVideos)
        .where(inArray(schema.ytVideos.ytVideoId, [...ytVideoIds]));

const upsertYoutubeChannel = async (
  db: DatabaseClient,
  channel: YoutubeChannelProfile,
) => {
  const [row] = await db
    .insert(schema.channels)
    .values({
      name: channel.title,
      ytChannelId: channel.id,
      ytCustomUrl: channel.customUrl,
      description: channel.description,
      avatarUrl: channel.avatarUrl,
      bannerUrl: channel.bannerUrl,
      subscriberCount: parseBigIntValue(channel.subscriberCount),
      totalViewCount: parseBigIntValue(channel.viewCount),
      videoCount:
        channel.videoCount !== undefined
          ? Number(channel.videoCount)
          : undefined,
      ytPublishedAt: parseDateValue(channel.publishedAt),
      lastYoutubeSyncedAt: new Date(),
      metadata: channel.metadata,
    })
    .onConflictDoUpdate({
      target: schema.channels.ytChannelId,
      set: {
        name: channel.title,
        ytCustomUrl: channel.customUrl,
        description: channel.description,
        avatarUrl: channel.avatarUrl,
        bannerUrl: channel.bannerUrl,
        subscriberCount: parseBigIntValue(channel.subscriberCount),
        totalViewCount: parseBigIntValue(channel.viewCount),
        videoCount:
          channel.videoCount !== undefined
            ? Number(channel.videoCount)
            : undefined,
        ytPublishedAt: parseDateValue(channel.publishedAt),
        lastYoutubeSyncedAt: new Date(),
        metadata: channel.metadata,
      },
    })
    .returning({
      id: schema.channels.id,
    });

  return row.id;
};

const upsertYoutubeVideoBundle = async (
  db: DatabaseClient,
  options: {
    readonly channelRowId: string;
    readonly bundle: YoutubeVideoBundle;
  },
) => {
  const [videoRow] = await db
    .insert(schema.ytVideos)
    .values({
      channelId: options.channelRowId,
      ytVideoId: options.bundle.video.id,
      title: options.bundle.video.title,
      description: options.bundle.video.description,
      publishedAt: new Date(options.bundle.video.publishedAt),
      durationSeconds: options.bundle.video.durationSeconds,
      thumbnailUrl: options.bundle.video.thumbnailUrl,
      categoryId: options.bundle.video.categoryId,
      defaultLanguage: options.bundle.video.defaultLanguage,
      contentKind: options.bundle.video.contentKind,
      tags: options.bundle.video.tags
        ? [...options.bundle.video.tags]
        : undefined,
      rawPayload: options.bundle.video.metadata,
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.ytVideos.ytVideoId,
      set: {
        channelId: options.channelRowId,
        title: options.bundle.video.title,
        description: options.bundle.video.description,
        publishedAt: new Date(options.bundle.video.publishedAt),
        durationSeconds: options.bundle.video.durationSeconds,
        thumbnailUrl: options.bundle.video.thumbnailUrl,
        categoryId: options.bundle.video.categoryId,
        defaultLanguage: options.bundle.video.defaultLanguage,
        contentKind: options.bundle.video.contentKind,
        tags: options.bundle.video.tags
          ? [...options.bundle.video.tags]
          : undefined,
        rawPayload: options.bundle.video.metadata,
        lastSeenAt: new Date(),
      },
    })
    .returning({
      id: schema.ytVideos.id,
    });

  await db.insert(schema.ytVideoMetricsSnapshots).values({
    videoId: videoRow.id,
    capturedAt: new Date(),
    viewCount: parseBigIntValue(options.bundle.video.viewCount),
    likeCount: parseBigIntValue(options.bundle.video.likeCount),
    commentCount: parseBigIntValue(options.bundle.video.commentCount),
    rawPayload: options.bundle.video.metadata,
  });

  return videoRow.id;
};

const upsertYoutubeComments = async (
  db: DatabaseClient,
  options: {
    readonly videoRowId: string;
    readonly comments: readonly YoutubeVideoComment[];
  },
) => {
  for (const comment of options.comments) {
    await db
      .insert(schema.ytComments)
      .values({
        videoId: options.videoRowId,
        ytCommentId: comment.id,
        parentYtCommentId: comment.parentCommentId,
        authorChannelId: comment.authorChannelId,
        authorDisplayName: comment.authorDisplayName,
        bodyText: comment.bodyText,
        likeCount: parseBigIntValue(comment.likeCount),
        replyCount: comment.replyCount,
        publishedAt: new Date(comment.publishedAt),
        sourceUpdatedAt: parseDateValue(comment.updatedAt),
        rawPayload: comment.metadata,
        lastSeenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.ytComments.ytCommentId,
        set: {
          videoId: options.videoRowId,
          parentYtCommentId: comment.parentCommentId,
          authorChannelId: comment.authorChannelId,
          authorDisplayName: comment.authorDisplayName,
          bodyText: comment.bodyText,
          likeCount: parseBigIntValue(comment.likeCount),
          replyCount: comment.replyCount,
          publishedAt: new Date(comment.publishedAt),
          sourceUpdatedAt: parseDateValue(comment.updatedAt),
          rawPayload: comment.metadata,
          lastSeenAt: new Date(),
        },
      });
  }
};

const createSyncRun = async (
  db: DatabaseClient,
  channelRowId: string,
  metadata: Record<string, unknown>,
) => {
  const [row] = await db
    .insert(schema.syncRuns)
    .values({
      source: "youtube-live-crawler",
      channelId: channelRowId,
      status: "running",
      metadata,
    })
    .returning({
      id: schema.syncRuns.id,
    });

  return row.id;
};

const finishSyncRun = async (
  db: DatabaseClient,
  options: {
    readonly syncRunId: string;
    readonly status: "completed" | "failed";
    readonly discoveredCount?: number;
    readonly insertedCount?: number;
    readonly updatedCount?: number;
    readonly errorMessage?: string;
  },
) =>
  db
    .update(schema.syncRuns)
    .set({
      status: options.status,
      discoveredCount: options.discoveredCount,
      insertedCount: options.insertedCount,
      updatedCount: options.updatedCount,
      errorMessage: options.errorMessage,
      finishedAt: new Date(),
    })
    .where(eq(schema.syncRuns.id, options.syncRunId));

export const syncLatestYoutubeVideos = (options: {
  readonly channelId: string;
  readonly limit?: number;
  readonly commentsPerVideo?: number;
}) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const youtube = yield* YoutubeReader;
    const limit = options.limit ?? 10;
    const commentsPerVideo = options.commentsPerVideo ?? 200;

    const { channel, videos } = yield* youtube.readChannelVideoSummaries({
      channelId: options.channelId,
      limit,
      sort: "newest",
    });

    const existingBefore = yield* Effect.tryPromise({
      try: () =>
        findExistingYoutubeVideos(
          database.db,
          videos.map((video) => video.videoId),
        ),
      catch: (cause) =>
        createCrawlHelpersError(
          "findExistingYoutubeVideos",
          `Failed to query existing YouTube videos for channel "${options.channelId}".`,
          cause,
        ),
    });

    const existingVideoIds = new Set(
      existingBefore.map((video) => video.ytVideoId),
    );
    const channelRowId = yield* Effect.tryPromise({
      try: () => upsertYoutubeChannel(database.db, channel),
      catch: (cause) =>
        createCrawlHelpersError(
          "upsertYoutubeChannel",
          `Failed to upsert YouTube channel "${channel.id}".`,
          cause,
        ),
    });
    const syncRunId = yield* Effect.tryPromise({
      try: () =>
        createSyncRun(database.db, channelRowId, {
          requestedChannelId: options.channelId,
          requestedLimit: limit,
        }),
      catch: (cause) =>
        createCrawlHelpersError(
          "createSyncRun",
          "Failed to create a sync run record.",
          cause,
        ),
    });

    return yield* Effect.gen(function* () {
      const bundles = yield* youtube.readVideosByIds({
        videoIds: videos.map((video) => video.videoId),
        includeComments: false,
      });
      const persistedVideoRowIds = new Map<string, string>();

      let insertedCount = 0;
      let updatedCount = 0;

      for (const bundle of bundles) {
        if (existingVideoIds.has(bundle.video.id)) {
          updatedCount += 1;
        } else {
          insertedCount += 1;
        }

        const videoRowId = yield* Effect.tryPromise({
          try: () =>
            upsertYoutubeVideoBundle(database.db, {
              channelRowId,
              bundle,
            }),
          catch: (cause) =>
            createCrawlHelpersError(
              "upsertYoutubeVideoBundle",
              `Failed to upsert video "${bundle.video.id}".`,
              cause,
            ),
        });

        persistedVideoRowIds.set(bundle.video.id, videoRowId);
      }

      const newVideoIds = bundles
        .map((bundle) => bundle.video.id)
        .filter((videoId) => !existingVideoIds.has(videoId));

      for (const videoId of newVideoIds) {
        const bundle = yield* youtube.readVideo({
          videoId,
          includeComments: true,
          commentsPerVideo,
        });
        const persistedVideoRowId = persistedVideoRowIds.get(videoId);

        if (!persistedVideoRowId) {
          return yield* Effect.fail(
            createCrawlHelpersError(
              "loadPersistedYoutubeVideoRow",
              `Persisted YouTube video row was not found for "${videoId}".`,
            ),
          );
        }

        yield* Effect.tryPromise({
          try: () =>
            upsertYoutubeComments(database.db, {
              videoRowId: persistedVideoRowId,
              comments: bundle.comments,
            }),
          catch: (cause) =>
            createCrawlHelpersError(
              "upsertYoutubeComments",
              `Failed to persist comments for "${videoId}".`,
              cause,
            ),
        });
      }

      yield* Effect.tryPromise({
        try: () =>
          finishSyncRun(database.db, {
            syncRunId,
            status: "completed",
            discoveredCount: bundles.length,
            insertedCount,
            updatedCount,
          }),
        catch: (cause) =>
          createCrawlHelpersError(
            "finishSyncRun",
            "Failed to mark the sync run as completed.",
            cause,
          ),
      });

      return {
        channelId: channelRowId,
        discoveredCount: bundles.length,
        insertedCount,
        updatedCount,
        commentSyncedVideoCount: newVideoIds.length,
      };
    }).pipe(
      Effect.tapError((error) =>
        Effect.tryPromise({
          try: () =>
            finishSyncRun(database.db, {
              syncRunId,
              status: "failed",
              errorMessage: error.message,
            }),
          catch: () => Promise.resolve(undefined),
        }).pipe(Effect.ignore),
      ),
    );
  });

export const listYoutubeChannels = Effect.gen(function* () {
  const database = yield* Database;

  return yield* Effect.tryPromise({
    try: () => loadYoutubeChannelsFromDatabase(database.db),
    catch: (cause) =>
      createCrawlHelpersError(
        "listYoutubeChannels",
        "Failed to load YouTube channels from the database.",
        cause,
      ),
  });
});

export const seedYoutubeChannel = (input: string) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const youtube = yield* YoutubeReader;
    const parsed = parseYoutubeChannelInput(input);
    const channel = yield* youtube.readChannel({
      channelId: parsed.channelId,
      query: parsed.channelId
        ? undefined
        : parsed.handle
          ? `@${parsed.handle}`
          : parsed.original,
    });
    const channelRowId = yield* Effect.tryPromise({
      try: () => upsertYoutubeChannel(database.db, channel),
      catch: (cause) =>
        createCrawlHelpersError(
          "seedYoutubeChannel",
          `Failed to persist YouTube channel "${channel.id}".`,
          cause,
        ),
    });

    return {
      channelId: channelRowId,
      ytChannelId: channel.id,
      title: channel.title,
    };
  });
