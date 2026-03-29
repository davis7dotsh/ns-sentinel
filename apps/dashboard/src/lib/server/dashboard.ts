import { Data, Effect } from "effect";
import { error } from "@sveltejs/kit";
import {
  Database,
  desc,
  eq,
  inArray,
  layer as databaseLayer,
  schema,
} from "@ns-sentinel/db";

class DashboardDataError extends Data.TaggedError("DashboardDataError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

const toDisplayCount = (value: bigint | null | undefined) =>
  value === null || value === undefined ? null : value.toString();

const toDisplayDate = (value: Date | null | undefined) =>
  value ? value.toISOString() : null;

const getYoutubeChannelUrl = (channel: {
  readonly ytCustomUrl: string | null;
  readonly ytChannelId: string;
}) =>
  channel.ytCustomUrl
    ? `https://www.youtube.com/${channel.ytCustomUrl.replace(/^@?/u, "@")}`
    : `https://www.youtube.com/channel/${channel.ytChannelId}`;

const getYoutubeVideoUrl = (ytVideoId: string) =>
  `https://www.youtube.com/watch?v=${ytVideoId}`;

const getYoutubeCommentUrl = (ytVideoId: string, ytCommentId: string) =>
  `${getYoutubeVideoUrl(ytVideoId)}&lc=${ytCommentId}`;

const getYoutubeAuthorChannelUrl = (authorChannelId: string | null) =>
  authorChannelId ? `https://www.youtube.com/channel/${authorChannelId}` : null;

const runDashboardEffect = async <A>(
  effect: Effect.Effect<A, DashboardDataError, Database>,
) =>
  Effect.runPromise(effect.pipe(Effect.provide(databaseLayer))).catch(
    (cause) => {
      if (
        typeof cause === "object" &&
        cause !== null &&
        "status" in cause &&
        typeof cause.status === "number"
      ) {
        throw cause;
      }

      console.error(cause);
      throw error(500, "Failed to load dashboard data.");
    },
  );

export const getChannelsData = () =>
  runDashboardEffect(
    Effect.gen(function* () {
      const database = yield* Database;
      const channels = yield* Effect.tryPromise({
        try: () =>
          database.db.query.channels.findMany({
            where: (channels, { isNotNull }) => isNotNull(channels.ytChannelId),
            orderBy: (channels, { desc }) => [
              desc(channels.lastYoutubeSyncedAt),
            ],
          }),
        catch: (cause) =>
          new DashboardDataError({
            message: "Failed to load channels.",
            cause,
          }),
      });

      return channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        description: channel.description,
        avatarUrl: channel.avatarUrl,
        ytChannelId: channel.ytChannelId,
        ytCustomUrl: channel.ytCustomUrl,
        youtubeUrl: getYoutubeChannelUrl(channel),
        subscriberCount: toDisplayCount(channel.subscriberCount),
        totalViewCount: toDisplayCount(channel.totalViewCount),
        videoCount: channel.videoCount,
        lastYoutubeSyncedAt: toDisplayDate(channel.lastYoutubeSyncedAt),
      }));
    }),
  );

export const getChannelPageData = (channelId: string) =>
  runDashboardEffect(
    Effect.gen(function* () {
      const database = yield* Database;
      const channel = yield* Effect.tryPromise({
        try: () =>
          database.db.query.channels.findFirst({
            where: (channels, { eq }) => eq(channels.id, channelId),
          }),
        catch: (cause) =>
          new DashboardDataError({
            message: `Failed to load channel "${channelId}".`,
            cause,
          }),
      });

      if (!channel) {
        throw error(404, "Channel not found.");
      }

      const videos = yield* Effect.tryPromise({
        try: () =>
          database.db.query.ytVideos.findMany({
            where: (ytVideos, { eq }) => eq(ytVideos.channelId, channelId),
            orderBy: (ytVideos, { desc }) => [desc(ytVideos.publishedAt)],
          }),
        catch: (cause) =>
          new DashboardDataError({
            message: `Failed to load videos for channel "${channelId}".`,
            cause,
          }),
      });

      const videoIds = videos.map((video) => video.id);
      const snapshots =
        videoIds.length === 0
          ? []
          : yield* Effect.tryPromise({
              try: () =>
                database.db
                  .select({
                    videoId: schema.ytVideoMetricsSnapshots.videoId,
                    capturedAt: schema.ytVideoMetricsSnapshots.capturedAt,
                    viewCount: schema.ytVideoMetricsSnapshots.viewCount,
                    likeCount: schema.ytVideoMetricsSnapshots.likeCount,
                    commentCount: schema.ytVideoMetricsSnapshots.commentCount,
                  })
                  .from(schema.ytVideoMetricsSnapshots)
                  .where(
                    inArray(schema.ytVideoMetricsSnapshots.videoId, videoIds),
                  )
                  .orderBy(
                    desc(schema.ytVideoMetricsSnapshots.capturedAt),
                    desc(schema.ytVideoMetricsSnapshots.videoId),
                  ),
              catch: (cause) =>
                new DashboardDataError({
                  message: `Failed to load video metrics for channel "${channelId}".`,
                  cause,
                }),
            });

      const latestSnapshotByVideoId = new Map<
        string,
        {
          readonly viewCount: string | null;
          readonly likeCount: string | null;
          readonly commentCount: string | null;
        }
      >();

      for (const snapshot of snapshots) {
        if (latestSnapshotByVideoId.has(snapshot.videoId)) {
          continue;
        }

        latestSnapshotByVideoId.set(snapshot.videoId, {
          viewCount: toDisplayCount(snapshot.viewCount),
          likeCount: toDisplayCount(snapshot.likeCount),
          commentCount: toDisplayCount(snapshot.commentCount),
        });
      }

      return {
        channel: {
          id: channel.id,
          name: channel.name,
          description: channel.description,
          avatarUrl: channel.avatarUrl,
          bannerUrl: channel.bannerUrl,
          ytChannelId: channel.ytChannelId,
          ytCustomUrl: channel.ytCustomUrl,
          youtubeUrl: getYoutubeChannelUrl(channel),
          subscriberCount: toDisplayCount(channel.subscriberCount),
          totalViewCount: toDisplayCount(channel.totalViewCount),
          videoCount: channel.videoCount,
        },
        videos: videos.map((video) => ({
          id: video.id,
          ytVideoId: video.ytVideoId,
          title: video.title,
          description: video.description,
          thumbnailUrl: video.thumbnailUrl,
          publishedAt: video.publishedAt.toISOString(),
          durationSeconds: video.durationSeconds,
          contentKind: video.contentKind,
          youtubeUrl: getYoutubeVideoUrl(video.ytVideoId),
          stats: latestSnapshotByVideoId.get(video.id) ?? {
            viewCount: null,
            likeCount: null,
            commentCount: null,
          },
        })),
      };
    }),
  );

export const getVideoPageData = (input: {
  readonly channelId: string;
  readonly videoId: string;
}) =>
  runDashboardEffect(
    Effect.gen(function* () {
      const database = yield* Database;
      const channel = yield* Effect.tryPromise({
        try: () =>
          database.db.query.channels.findFirst({
            where: (channels, { eq }) => eq(channels.id, input.channelId),
          }),
        catch: (cause) =>
          new DashboardDataError({
            message: `Failed to load channel "${input.channelId}".`,
            cause,
          }),
      });

      if (!channel) {
        throw error(404, "Channel not found.");
      }

      const video = yield* Effect.tryPromise({
        try: () =>
          database.db.query.ytVideos.findFirst({
            where: (ytVideos, { and, eq }) =>
              and(
                eq(ytVideos.id, input.videoId),
                eq(ytVideos.channelId, input.channelId),
              ),
          }),
        catch: (cause) =>
          new DashboardDataError({
            message: `Failed to load video "${input.videoId}".`,
            cause,
          }),
      });

      if (!video) {
        throw error(404, "Video not found.");
      }

      const [latestSnapshot] = yield* Effect.tryPromise({
        try: () =>
          database.db
            .select({
              viewCount: schema.ytVideoMetricsSnapshots.viewCount,
              likeCount: schema.ytVideoMetricsSnapshots.likeCount,
              commentCount: schema.ytVideoMetricsSnapshots.commentCount,
              capturedAt: schema.ytVideoMetricsSnapshots.capturedAt,
            })
            .from(schema.ytVideoMetricsSnapshots)
            .where(eq(schema.ytVideoMetricsSnapshots.videoId, input.videoId))
            .orderBy(desc(schema.ytVideoMetricsSnapshots.capturedAt))
            .limit(1),
        catch: (cause) =>
          new DashboardDataError({
            message: `Failed to load video metrics for "${input.videoId}".`,
            cause,
          }),
      });

      const comments = yield* Effect.tryPromise({
        try: () =>
          database.db.query.ytComments.findMany({
            where: (ytComments, { eq }) =>
              eq(ytComments.videoId, input.videoId),
            orderBy: (ytComments, { desc }) => [
              desc(ytComments.likeCount),
              desc(ytComments.publishedAt),
            ],
          }),
        catch: (cause) =>
          new DashboardDataError({
            message: `Failed to load comments for "${input.videoId}".`,
            cause,
          }),
      });

      return {
        channel: {
          id: channel.id,
          name: channel.name,
          youtubeUrl: getYoutubeChannelUrl(channel),
        },
        video: {
          id: video.id,
          ytVideoId: video.ytVideoId,
          title: video.title,
          description: video.description,
          thumbnailUrl: video.thumbnailUrl,
          publishedAt: video.publishedAt.toISOString(),
          durationSeconds: video.durationSeconds,
          categoryId: video.categoryId,
          defaultLanguage: video.defaultLanguage,
          contentKind: video.contentKind,
          tags: video.tags ?? [],
          youtubeUrl: getYoutubeVideoUrl(video.ytVideoId),
          stats: {
            viewCount: toDisplayCount(latestSnapshot?.viewCount),
            likeCount: toDisplayCount(latestSnapshot?.likeCount),
            commentCount: toDisplayCount(latestSnapshot?.commentCount),
            capturedAt: toDisplayDate(latestSnapshot?.capturedAt),
          },
        },
        comments: comments.map((comment) => ({
          id: comment.id,
          ytCommentId: comment.ytCommentId,
          authorDisplayName: comment.authorDisplayName,
          authorChannelId: comment.authorChannelId,
          authorChannelUrl: getYoutubeAuthorChannelUrl(comment.authorChannelId),
          bodyText: comment.bodyText,
          likeCount: toDisplayCount(comment.likeCount),
          replyCount: comment.replyCount,
          publishedAt: comment.publishedAt.toISOString(),
          youtubeUrl: getYoutubeCommentUrl(
            video.ytVideoId,
            comment.ytCommentId,
          ),
        })),
      };
    }),
  );
