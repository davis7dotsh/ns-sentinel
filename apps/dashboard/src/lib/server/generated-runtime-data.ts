import { Data, Effect } from "effect";
import { error } from "@sveltejs/kit";
import { Database, desc, inArray, layer as databaseLayer, schema } from "@ns-sentinel/db";

class GeneratedRuntimeDataError extends Data.TaggedError("GeneratedRuntimeDataError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

const toDisplayCount = (value: bigint | null | undefined) =>
  value === null || value === undefined ? null : value.toString();

const getYoutubeChannelUrl = (channel: {
  readonly ytCustomUrl: string | null;
  readonly ytChannelId: string;
}) =>
  channel.ytCustomUrl
    ? `https://www.youtube.com/${channel.ytCustomUrl.replace(/^@?/u, "@")}`
    : `https://www.youtube.com/channel/${channel.ytChannelId}`;

const runGeneratedRuntimeEffect = async <A>(
  effect: Effect.Effect<A, GeneratedRuntimeDataError, Database>,
) =>
  Effect.runPromise(effect.pipe(Effect.provide(databaseLayer))).catch((cause) => {
    console.error(cause);
    throw error(500, "Failed to load generated runtime data.");
  });

export const getGeneratedChannelsCatalogData = () =>
  runGeneratedRuntimeEffect(
    Effect.gen(function* () {
      const database = yield* Database;
      const channels = yield* Effect.tryPromise({
        try: () =>
          database.db.query.channels.findMany({
            orderBy: (channels, { desc }) => [desc(channels.lastYoutubeSyncedAt)],
          }),
        catch: (cause) =>
          new GeneratedRuntimeDataError({
            message: "Failed to load generated runtime channel catalog.",
            cause,
          }),
      });

      return channels.map((channel) => ({
        avatarUrl: channel.avatarUrl,
        id: channel.id,
        lastXSyncedAt: channel.lastXSyncedAt?.toISOString() ?? null,
        lastYoutubeSyncedAt: channel.lastYoutubeSyncedAt?.toISOString() ?? null,
        name: channel.name,
        subscriberCount: toDisplayCount(channel.subscriberCount),
        videoCount: channel.videoCount,
        xUsername: channel.xUsername,
        ytChannelId: channel.ytChannelId,
        ytCustomUrl: channel.ytCustomUrl,
        youtubeUrl: getYoutubeChannelUrl(channel),
      }));
    }),
  );

export const getLatestGeneratedChannelOverviewData = () =>
  runGeneratedRuntimeEffect(
    Effect.gen(function* () {
      const database = yield* Database;
      const channel = yield* Effect.tryPromise({
        try: () =>
          database.db.query.channels.findFirst({
            orderBy: (channels, { desc }) => [desc(channels.lastYoutubeSyncedAt)],
          }),
        catch: (cause) =>
          new GeneratedRuntimeDataError({
            message: "Failed to load the latest generated runtime channel.",
            cause,
          }),
      });

      if (!channel) {
        return {
          channel: null,
          posts: [],
          videos: [],
        };
      }

      const videos = yield* Effect.tryPromise({
        try: () =>
          database.db.query.ytVideos.findMany({
            limit: 6,
            orderBy: (ytVideos, { desc }) => [desc(ytVideos.publishedAt)],
            where: (ytVideos, { eq }) => eq(ytVideos.channelId, channel.id),
          }),
        catch: (cause) =>
          new GeneratedRuntimeDataError({
            message: `Failed to load videos for generated runtime channel "${channel.id}".`,
            cause,
          }),
      });

      const posts = yield* Effect.tryPromise({
        try: () =>
          database.db.query.xPosts.findMany({
            limit: 6,
            orderBy: (xPosts, { desc }) => [desc(xPosts.sourceCreatedAt)],
            where: (xPosts, { eq }) => eq(xPosts.channelId, channel.id),
          }),
        catch: (cause) =>
          new GeneratedRuntimeDataError({
            message: `Failed to load X posts for generated runtime channel "${channel.id}".`,
            cause,
          }),
      });

      const videoIds = videos.map((video) => video.id);
      const postIds = posts.map((post) => post.id);

      const videoSnapshots =
        videoIds.length === 0
          ? []
          : yield* Effect.tryPromise({
              try: () =>
                database.db
                  .select({
                    commentCount: schema.ytVideoMetricsSnapshots.commentCount,
                    likeCount: schema.ytVideoMetricsSnapshots.likeCount,
                    videoId: schema.ytVideoMetricsSnapshots.videoId,
                    viewCount: schema.ytVideoMetricsSnapshots.viewCount,
                  })
                  .from(schema.ytVideoMetricsSnapshots)
                  .where(inArray(schema.ytVideoMetricsSnapshots.videoId, videoIds))
                  .orderBy(desc(schema.ytVideoMetricsSnapshots.capturedAt)),
              catch: (cause) =>
                new GeneratedRuntimeDataError({
                  message: `Failed to load video metrics for generated runtime channel "${channel.id}".`,
                  cause,
                }),
            });

      const postSnapshots =
        postIds.length === 0
          ? []
          : yield* Effect.tryPromise({
              try: () =>
                database.db
                  .select({
                    likeCount: schema.xPostMetricsSnapshots.likeCount,
                    postId: schema.xPostMetricsSnapshots.postId,
                    repostCount: schema.xPostMetricsSnapshots.repostCount,
                    viewCount: schema.xPostMetricsSnapshots.viewCount,
                  })
                  .from(schema.xPostMetricsSnapshots)
                  .where(inArray(schema.xPostMetricsSnapshots.postId, postIds))
                  .orderBy(desc(schema.xPostMetricsSnapshots.capturedAt)),
              catch: (cause) =>
                new GeneratedRuntimeDataError({
                  message: `Failed to load X metrics for generated runtime channel "${channel.id}".`,
                  cause,
                }),
            });

      const latestVideoSnapshotById = new Map<
        string,
        {
          readonly commentCount: string | null;
          readonly likeCount: string | null;
          readonly viewCount: string | null;
        }
      >();

      for (const snapshot of videoSnapshots) {
        if (latestVideoSnapshotById.has(snapshot.videoId)) {
          continue;
        }

        latestVideoSnapshotById.set(snapshot.videoId, {
          commentCount: toDisplayCount(snapshot.commentCount),
          likeCount: toDisplayCount(snapshot.likeCount),
          viewCount: toDisplayCount(snapshot.viewCount),
        });
      }

      const latestPostSnapshotById = new Map<
        string,
        {
          readonly likeCount: string | null;
          readonly repostCount: string | null;
          readonly viewCount: string | null;
        }
      >();

      for (const snapshot of postSnapshots) {
        if (latestPostSnapshotById.has(snapshot.postId)) {
          continue;
        }

        latestPostSnapshotById.set(snapshot.postId, {
          likeCount: toDisplayCount(snapshot.likeCount),
          repostCount: toDisplayCount(snapshot.repostCount),
          viewCount: toDisplayCount(snapshot.viewCount),
        });
      }

      return {
        channel: {
          avatarUrl: channel.avatarUrl,
          description: channel.description,
          id: channel.id,
          name: channel.name,
          subscriberCount: toDisplayCount(channel.subscriberCount),
          totalViewCount: toDisplayCount(channel.totalViewCount),
          videoCount: channel.videoCount,
          youtubeUrl: getYoutubeChannelUrl(channel),
        },
        posts: posts.map((post) => ({
          id: post.id,
          sourceCreatedAt: post.sourceCreatedAt.toISOString(),
          stats: latestPostSnapshotById.get(post.id) ?? {
            likeCount: null,
            repostCount: null,
            viewCount: null,
          },
          text: post.text,
          xPostId: post.xPostId,
        })),
        videos: videos.map((video) => ({
          id: video.id,
          publishedAt: video.publishedAt.toISOString(),
          stats: latestVideoSnapshotById.get(video.id) ?? {
            commentCount: null,
            likeCount: null,
            viewCount: null,
          },
          thumbnailUrl: video.thumbnailUrl,
          title: video.title,
          ytVideoId: video.ytVideoId,
        })),
      };
    }),
  );
