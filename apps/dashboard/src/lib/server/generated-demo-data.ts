import { desc, eq, inArray } from "drizzle-orm";
import { Data, Effect } from "effect";
import { error } from "@sveltejs/kit";
import { Database, layer as databaseLayer, schema } from "@ns-sentinel/db";

class GeneratedDemoDataError extends Data.TaggedError(
  "GeneratedDemoDataError",
)<{
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

const runGeneratedDemoEffect = async <A>(
  effect: Effect.Effect<A, GeneratedDemoDataError, Database>,
) =>
  Effect.runPromise(effect.pipe(Effect.provide(databaseLayer))).catch(
    (cause) => {
      console.error(cause);
      throw error(500, "Failed to load generated demo data.");
    },
  );

export const getGeneratedDemoData = () =>
  runGeneratedDemoEffect(
    Effect.gen(function* () {
      const database = yield* Database;
      const channel = yield* Effect.tryPromise({
        try: () =>
          database.db.query.channels.findFirst({
            orderBy: (channels, { desc }) => [
              desc(channels.lastYoutubeSyncedAt),
            ],
          }),
        catch: (cause) =>
          new GeneratedDemoDataError({
            message: "Failed to load the demo channel.",
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
            limit: 4,
            orderBy: (ytVideos, { desc }) => [desc(ytVideos.publishedAt)],
            where: (ytVideos, { eq }) => eq(ytVideos.channelId, channel.id),
          }),
        catch: (cause) =>
          new GeneratedDemoDataError({
            message: `Failed to load videos for "${channel.id}".`,
            cause,
          }),
      });

      const posts = yield* Effect.tryPromise({
        try: () =>
          database.db.query.xPosts.findMany({
            limit: 4,
            orderBy: (xPosts, { desc }) => [desc(xPosts.sourceCreatedAt)],
            where: (xPosts, { eq }) => eq(xPosts.channelId, channel.id),
          }),
        catch: (cause) =>
          new GeneratedDemoDataError({
            message: `Failed to load posts for "${channel.id}".`,
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
                  .where(
                    inArray(schema.ytVideoMetricsSnapshots.videoId, videoIds),
                  )
                  .orderBy(desc(schema.ytVideoMetricsSnapshots.capturedAt)),
              catch: (cause) =>
                new GeneratedDemoDataError({
                  message: `Failed to load video metrics for "${channel.id}".`,
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
                new GeneratedDemoDataError({
                  message: `Failed to load post metrics for "${channel.id}".`,
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
