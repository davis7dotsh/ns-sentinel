/**
 * Getting started:
 * 1. In Google Cloud, create or reuse a project and enable the YouTube Data API v3.
 * 2. Create an API key in Google Cloud Credentials and export it as `YOUTUBE_API_KEY`.
 * 3. Optionally export `YOUTUBE_CHANNEL_ID` to look up a specific public channel directly.
 * 4. Otherwise this script uses `YOUTUBE_QUERY` (default: `Google for Developers`) to find a public channel.
 */

import { google, youtube_v3 } from "googleapis";
import { Config, Effect, Layer, Option, ServiceMap } from "effect";
import {
  createSentinelError,
  isDirectExecution,
  runNodeMain,
  withEnvConfig,
} from "@ns-sentinel/core";

const YoutubeConfigSource = Config.all({
  apiKey: Config.string("YOUTUBE_API_KEY"),
  channelId: Config.option(Config.string("YOUTUBE_CHANNEL_ID")),
  query: Config.string("YOUTUBE_QUERY").pipe(Config.withDefault("Google for Developers")),
});

const youtubeModule = "@ns-sentinel/youtube-read";
const youtubeRetryableStatuses = new Set([403, 408, 409, 425, 429, 500, 502, 503, 504]);
const maxBatchVideoIds = 50;

type YoutubeApi = youtube_v3.Youtube;
type YoutubeVideoResource = youtube_v3.Schema$Video;
type YoutubeCommentThread = youtube_v3.Schema$CommentThread;
type YoutubeChannelResource = youtube_v3.Schema$Channel;

export type YoutubeChannelProfile = {
  readonly id: string;
  readonly title: string;
  readonly description: string | undefined;
  readonly customUrl: string | undefined;
  readonly publishedAt: string | undefined;
  readonly uploadsPlaylistId: string | undefined;
  readonly avatarUrl: string | undefined;
  readonly bannerUrl: string | undefined;
  readonly subscriberCount: string | undefined;
  readonly viewCount: string | undefined;
  readonly videoCount: string | undefined;
  readonly metadata: YoutubeChannelResource;
};

export type YoutubeVideoSummary = {
  readonly videoId: string;
  readonly position: number;
  readonly publishedAt: string | undefined;
};

export type YoutubeVideoComment = {
  readonly id: string;
  readonly parentCommentId: string | undefined;
  readonly authorChannelId: string | undefined;
  readonly authorDisplayName: string | undefined;
  readonly bodyText: string;
  readonly likeCount: number | undefined;
  readonly replyCount: number | undefined;
  readonly publishedAt: string;
  readonly updatedAt: string | undefined;
  readonly metadata: YoutubeCommentThread;
};

export type YoutubeVideoRecord = {
  readonly id: string;
  readonly channelId: string | undefined;
  readonly channelTitle: string | undefined;
  readonly title: string;
  readonly description: string | undefined;
  readonly publishedAt: string;
  readonly durationSeconds: number | undefined;
  readonly thumbnailUrl: string | undefined;
  readonly categoryId: string | undefined;
  readonly defaultLanguage: string | undefined;
  readonly contentKind: string;
  readonly liveBroadcastContent: string | undefined;
  readonly tags: readonly string[] | undefined;
  readonly viewCount: string | undefined;
  readonly likeCount: string | undefined;
  readonly commentCount: string | undefined;
  readonly metadata: YoutubeVideoResource;
};

export type YoutubeVideoBundle = {
  readonly video: YoutubeVideoRecord;
  readonly comments: readonly YoutubeVideoComment[];
};

export type ReadYoutubeChannelVideosOptions = {
  readonly channelId?: string;
  readonly query?: string;
  readonly limit?: number;
  readonly sort?: "newest" | "oldest";
  readonly includeComments?: boolean;
  readonly commentsPerVideo?: number;
};

export type ReadYoutubeVideoOptions = {
  readonly videoId: string;
  readonly includeComments?: boolean;
  readonly commentsPerVideo?: number;
};

const parseChannelLookupQuery = (query: string | undefined) => {
  if (!query) {
    return undefined;
  }

  const trimmed = query.trim();
  const channelIdMatch =
    /youtube\.com\/channel\/([A-Za-z0-9_-]+)/iu.exec(trimmed) ??
    /^(UC[A-Za-z0-9_-]{20,})$/u.exec(trimmed);
  const handleMatch =
    /youtube\.com\/@([A-Za-z0-9._-]+)/iu.exec(trimmed) ?? /^@([A-Za-z0-9._-]+)$/u.exec(trimmed);
  const usernameMatch = /youtube\.com\/user\/([A-Za-z0-9._-]+)/iu.exec(trimmed);

  return {
    channelId: channelIdMatch?.[1],
    handle: handleMatch?.[1],
    query: trimmed,
    username: usernameMatch?.[1],
  };
};

const chunk = <A>(items: readonly A[], size: number) => {
  const chunks: A[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const pickBestThumbnailUrl = (thumbnails: youtube_v3.Schema$ThumbnailDetails | undefined) =>
  thumbnails?.maxres?.url ??
  thumbnails?.standard?.url ??
  thumbnails?.high?.url ??
  thumbnails?.medium?.url ??
  thumbnails?.default?.url ??
  undefined;

const parseIsoDurationToSeconds = (isoDuration: string | undefined) => {
  if (!isoDuration) {
    return undefined;
  }

  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/u.exec(isoDuration);

  if (!match) {
    return undefined;
  }

  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;

  return (
    Number(days) * 24 * 60 * 60 + Number(hours) * 60 * 60 + Number(minutes) * 60 + Number(seconds)
  );
};

const createYoutubeError = (operation: string, message: string, cause?: unknown) =>
  createSentinelError({
    module: youtubeModule,
    operation,
    message,
    cause,
  });

const getYoutubeStatusCode = (cause: unknown) => {
  if (typeof cause !== "object" || cause === null) {
    return undefined;
  }

  const response = "response" in cause ? cause.response : undefined;

  if (typeof response !== "object" || response === null) {
    return undefined;
  }

  return "status" in response && typeof response.status === "number" ? response.status : undefined;
};

const getYoutubeErrorReason = (cause: unknown) => {
  if (typeof cause !== "object" || cause === null) {
    return undefined;
  }

  const response = "response" in cause ? cause.response : undefined;

  if (typeof response !== "object" || response === null) {
    return undefined;
  }

  const data = "data" in response ? response.data : undefined;

  if (typeof data !== "object" || data === null || !("error" in data)) {
    return undefined;
  }

  const errorData = data.error;

  if (
    typeof errorData !== "object" ||
    errorData === null ||
    !("errors" in errorData) ||
    !Array.isArray(errorData.errors)
  ) {
    return undefined;
  }

  const firstError = errorData.errors[0];

  return typeof firstError === "object" &&
    firstError !== null &&
    "reason" in firstError &&
    typeof firstError.reason === "string"
    ? firstError.reason
    : undefined;
};

const shouldRetryYoutubeCall = (cause: unknown) => {
  const status = getYoutubeStatusCode(cause);

  if (status !== undefined && youtubeRetryableStatuses.has(status)) {
    return true;
  }

  const reason = getYoutubeErrorReason(cause);

  return (
    reason === "quotaExceeded" ||
    reason === "userRateLimitExceeded" ||
    reason === "rateLimitExceeded" ||
    reason === "backendError"
  );
};

const retryYoutubeCall = <A>(
  operation: string,
  task: () => Promise<A>,
  options?: {
    readonly retries?: number;
    readonly initialDelayMs?: number;
  },
) => {
  const retries = options?.retries ?? 4;
  const initialDelayMs = options?.initialDelayMs ?? 750;

  const loop = (attempt: number): Effect.Effect<A, ReturnType<typeof createSentinelError>> =>
    Effect.tryPromise({
      try: task,
      catch: (cause) =>
        createYoutubeError(operation, `YouTube API request failed during ${operation}.`, cause),
    }).pipe(
      Effect.catchIf(
        (error) => shouldRetryYoutubeCall(error.cause) && attempt < retries,
        () => Effect.sleep(initialDelayMs * 2 ** attempt).pipe(Effect.andThen(loop(attempt + 1))),
      ),
    );

  return loop(0);
};

const normalizeChannel = (channel: YoutubeChannelResource): YoutubeChannelProfile | undefined => {
  if (!channel.id || !channel.snippet?.title) {
    return undefined;
  }

  return {
    id: channel.id,
    title: channel.snippet.title,
    description: channel.snippet.description ?? undefined,
    customUrl: channel.snippet.customUrl ?? undefined,
    publishedAt: channel.snippet.publishedAt ?? undefined,
    uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads ?? undefined,
    avatarUrl: pickBestThumbnailUrl(channel.snippet.thumbnails),
    bannerUrl:
      channel.brandingSettings?.image?.bannerExternalUrl ??
      channel.brandingSettings?.image?.bannerMobileExtraHdImageUrl ??
      undefined,
    subscriberCount: channel.statistics?.subscriberCount ?? undefined,
    viewCount: channel.statistics?.viewCount ?? undefined,
    videoCount: channel.statistics?.videoCount ?? undefined,
    metadata: channel,
  };
};

const normalizeVideo = (video: YoutubeVideoResource): YoutubeVideoRecord | undefined => {
  const videoId = video.id ?? undefined;
  const publishedAt = video.snippet?.publishedAt ?? undefined;
  const title = video.snippet?.title ?? undefined;

  if (!videoId || !publishedAt || !title) {
    return undefined;
  }

  return {
    id: videoId,
    channelId: video.snippet?.channelId ?? undefined,
    channelTitle: video.snippet?.channelTitle ?? undefined,
    title,
    description: video.snippet?.description ?? undefined,
    publishedAt,
    durationSeconds: parseIsoDurationToSeconds(video.contentDetails?.duration ?? undefined),
    thumbnailUrl: pickBestThumbnailUrl(video.snippet?.thumbnails),
    categoryId: video.snippet?.categoryId ?? undefined,
    defaultLanguage:
      video.snippet?.defaultLanguage ?? video.snippet?.defaultAudioLanguage ?? undefined,
    contentKind:
      video.snippet?.liveBroadcastContent && video.snippet.liveBroadcastContent !== "none"
        ? video.snippet.liveBroadcastContent
        : "video",
    liveBroadcastContent: video.snippet?.liveBroadcastContent ?? undefined,
    tags: video.snippet?.tags ?? undefined,
    viewCount: video.statistics?.viewCount ?? undefined,
    likeCount: video.statistics?.likeCount ?? undefined,
    commentCount: video.statistics?.commentCount ?? undefined,
    metadata: video,
  };
};

const normalizeComment = (thread: YoutubeCommentThread): YoutubeVideoComment | undefined => {
  const topLevelComment = thread.snippet?.topLevelComment;
  const snippet = topLevelComment?.snippet;
  const commentId = topLevelComment?.id ?? undefined;
  const bodyText = snippet?.textOriginal ?? snippet?.textDisplay ?? undefined;
  const publishedAt = snippet?.publishedAt ?? undefined;

  if (!commentId || !bodyText || !publishedAt) {
    return undefined;
  }

  return {
    id: commentId,
    parentCommentId: undefined,
    authorChannelId: snippet?.authorChannelId?.value ?? undefined,
    authorDisplayName: snippet?.authorDisplayName ?? undefined,
    bodyText,
    likeCount: snippet?.likeCount ?? undefined,
    replyCount: thread.snippet?.totalReplyCount ?? undefined,
    publishedAt,
    updatedAt: snippet?.updatedAt ?? undefined,
    metadata: thread,
  };
};

const fetchChannelFromApi = (
  youtube: YoutubeApi,
  input: {
    readonly channelId?: string;
    readonly query?: string;
  },
) =>
  Effect.gen(function* () {
    const parsedQuery = parseChannelLookupQuery(input.query);
    const resolvedChannelId = input.channelId ?? parsedQuery?.channelId;

    const response = resolvedChannelId
      ? yield* retryYoutubeCall("channels.list", () =>
          youtube.channels.list({
            id: [resolvedChannelId],
            part: ["snippet", "statistics", "contentDetails", "brandingSettings"],
            maxResults: 1,
          }),
        )
      : parsedQuery?.handle
        ? yield* retryYoutubeCall("channels.list", () =>
            youtube.channels.list({
              forHandle: parsedQuery.handle,
              part: ["snippet", "statistics", "contentDetails", "brandingSettings"],
              maxResults: 1,
            }),
          )
        : parsedQuery?.username
          ? yield* retryYoutubeCall("channels.list", () =>
              youtube.channels.list({
                forUsername: parsedQuery.username,
                part: ["snippet", "statistics", "contentDetails", "brandingSettings"],
                maxResults: 1,
              }),
            )
          : yield* retryYoutubeCall("search.list", () =>
              youtube.search
                .list({
                  q: input.query,
                  type: ["channel"],
                  maxResults: 1,
                  part: ["snippet"],
                })
                .then((searchResponse) => {
                  const searchedChannelId = searchResponse.data.items?.[0]?.id?.channelId;

                  if (!searchedChannelId) {
                    throw createYoutubeError(
                      "search.list",
                      `No public YouTube channel was found for query "${input.query ?? ""}".`,
                    );
                  }

                  return youtube.channels.list({
                    id: [searchedChannelId],
                    part: ["snippet", "statistics", "contentDetails", "brandingSettings"],
                    maxResults: 1,
                  });
                }),
            );

    const channel = response.data.items?.[0];
    const normalized = channel ? normalizeChannel(channel) : undefined;

    if (!normalized) {
      return yield* Effect.fail(
        createYoutubeError(
          "channels.list",
          `No YouTube channel was returned for lookup "${input.channelId ?? input.query ?? ""}".`,
        ),
      );
    }

    return normalized;
  });

const fetchChannelVideoSummaries = (
  youtube: YoutubeApi,
  options: {
    readonly uploadsPlaylistId: string;
    readonly limit: number;
    readonly sort: "newest" | "oldest";
  },
) =>
  Effect.gen(function* () {
    const items: YoutubeVideoSummary[] = [];
    let pageToken: string | undefined;

    while (items.length < options.limit) {
      const response = yield* retryYoutubeCall("playlistItems.list", () =>
        youtube.playlistItems.list({
          playlistId: options.uploadsPlaylistId,
          part: ["contentDetails", "snippet"],
          maxResults: Math.min(50, options.limit - items.length),
          pageToken,
        }),
      );

      for (const item of response.data.items ?? []) {
        const videoId = item.contentDetails?.videoId ?? undefined;

        if (!videoId) {
          continue;
        }

        items.push({
          videoId,
          position: item.snippet?.position ?? items.length,
          publishedAt:
            item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt ?? undefined,
        });
      }

      pageToken = response.data.nextPageToken ?? undefined;

      if (!pageToken) {
        break;
      }
    }

    return options.sort === "oldest" ? [...items].reverse() : items;
  });

const fetchVideosByIds = (youtube: YoutubeApi, videoIds: readonly string[]) =>
  Effect.gen(function* () {
    const ids = [...new Set(videoIds)].filter(Boolean);

    if (ids.length === 0) {
      return [] as YoutubeVideoRecord[];
    }

    const records: YoutubeVideoRecord[] = [];

    for (const currentIds of chunk(ids, maxBatchVideoIds)) {
      const response = yield* retryYoutubeCall("videos.list", () =>
        youtube.videos.list({
          id: currentIds,
          part: ["snippet", "statistics", "contentDetails"],
          maxResults: currentIds.length,
        }),
      );

      for (const item of response.data.items ?? []) {
        const record = normalizeVideo(item);

        if (record) {
          records.push(record);
        }
      }
    }

    return records;
  });

const fetchVideoComments = (
  youtube: YoutubeApi,
  options: {
    readonly videoId: string;
    readonly commentsPerVideo: number;
  },
) =>
  Effect.gen(function* () {
    if (options.commentsPerVideo <= 0) {
      return [] as YoutubeVideoComment[];
    }

    const comments: YoutubeVideoComment[] = [];
    let pageToken: string | undefined;

    while (comments.length < options.commentsPerVideo) {
      const response = yield* retryYoutubeCall(
        "commentThreads.list",
        () =>
          youtube.commentThreads.list({
            videoId: options.videoId,
            part: ["snippet"],
            textFormat: "plainText",
            order: "relevance",
            maxResults: Math.min(100, options.commentsPerVideo - comments.length),
            pageToken,
          }),
        { retries: 2, initialDelayMs: 1000 },
      ).pipe(
        Effect.catchIf(
          (error) => {
            const status = getYoutubeStatusCode(error.cause);
            const reason = getYoutubeErrorReason(error.cause);

            return status === 403 && (reason === "commentsDisabled" || reason === "forbidden");
          },
          () => Effect.succeed(undefined),
        ),
      );

      if (!response) {
        return comments;
      }

      for (const item of response.data.items ?? []) {
        const comment = normalizeComment(item);

        if (comment) {
          comments.push(comment);
        }
      }

      pageToken = response.data.nextPageToken ?? undefined;

      if (!pageToken) {
        break;
      }
    }

    return comments;
  });

export class YoutubeReadConfig extends ServiceMap.Service<
  YoutubeReadConfig,
  {
    readonly apiKey: string;
    readonly channelId: Option.Option<string>;
    readonly query: string;
  }
>()("YoutubeReadConfig", {
  make: withEnvConfig(YoutubeConfigSource.asEffect()),
}) {
  static readonly layer = Layer.effect(this)(this.make);
}

export class YoutubeReader extends ServiceMap.Service<
  YoutubeReader,
  {
    readonly readChannel: (options?: {
      readonly channelId?: string;
      readonly query?: string;
    }) => Effect.Effect<YoutubeChannelProfile, ReturnType<typeof createSentinelError>>;
    readonly readChannelVideoSummaries: (
      options?: Omit<ReadYoutubeChannelVideosOptions, "includeComments" | "commentsPerVideo">,
    ) => Effect.Effect<
      {
        readonly channel: YoutubeChannelProfile;
        readonly videos: readonly YoutubeVideoSummary[];
      },
      ReturnType<typeof createSentinelError>
    >;
    readonly readVideosByIds: (options: {
      readonly videoIds: readonly string[];
      readonly includeComments?: boolean;
      readonly commentsPerVideo?: number;
    }) => Effect.Effect<readonly YoutubeVideoBundle[], ReturnType<typeof createSentinelError>>;
    readonly readVideo: (
      options: ReadYoutubeVideoOptions,
    ) => Effect.Effect<YoutubeVideoBundle, ReturnType<typeof createSentinelError>>;
    readonly readChannelVideos: (options?: ReadYoutubeChannelVideosOptions) => Effect.Effect<
      {
        readonly channel: YoutubeChannelProfile;
        readonly videos: readonly YoutubeVideoBundle[];
      },
      ReturnType<typeof createSentinelError>
    >;
  }
>()("YoutubeReader") {
  static readonly layer = Layer.effect(this)(
    Effect.gen(function* () {
      const config = yield* YoutubeReadConfig;
      const youtube = google.youtube({ version: "v3", auth: config.apiKey });

      const loadChannel = (options?: { readonly channelId?: string; readonly query?: string }) =>
        fetchChannelFromApi(youtube, {
          channelId:
            options?.channelId ??
            (Option.isSome(config.channelId) ? config.channelId.value : undefined),
          query: options?.query ?? config.query,
        });

      const loadVideoBundles = (options: {
        readonly videoIds: readonly string[];
        readonly includeComments?: boolean;
        readonly commentsPerVideo?: number;
      }) =>
        Effect.gen(function* () {
          const records = yield* fetchVideosByIds(youtube, options.videoIds);
          const recordMap = new Map(records.map((record) => [record.id, record]));
          const dedupedIds = [...new Set(options.videoIds)];
          const bundles: YoutubeVideoBundle[] = [];

          for (const videoId of dedupedIds) {
            const record = recordMap.get(videoId);

            if (!record) {
              continue;
            }

            const comments =
              options.includeComments === true
                ? yield* fetchVideoComments(youtube, {
                    videoId,
                    commentsPerVideo: options.commentsPerVideo ?? 200,
                  })
                : [];

            bundles.push({
              video: record,
              comments,
            });
          }

          return bundles;
        });
      const loadChannelVideoSummaries = (
        options?: Omit<ReadYoutubeChannelVideosOptions, "includeComments" | "commentsPerVideo">,
      ) =>
        Effect.gen(function* () {
          const channel = yield* loadChannel(options);

          if (!channel.uploadsPlaylistId) {
            return yield* Effect.fail(
              createYoutubeError(
                "channels.list",
                `Channel "${channel.id}" does not expose an uploads playlist.`,
              ),
            );
          }

          const videos = yield* fetchChannelVideoSummaries(youtube, {
            uploadsPlaylistId: channel.uploadsPlaylistId,
            limit: options?.limit ?? 10,
            sort: options?.sort ?? "newest",
          });

          return { channel, videos };
        });

      return YoutubeReader.of({
        readChannel: (options) => loadChannel(options),
        readChannelVideoSummaries: (options) => loadChannelVideoSummaries(options),
        readVideosByIds: (options) => loadVideoBundles(options),
        readVideo: (options) =>
          loadVideoBundles({
            videoIds: [options.videoId],
            includeComments: options.includeComments,
            commentsPerVideo: options.commentsPerVideo,
          }).pipe(
            Effect.flatMap((bundles) =>
              bundles[0]
                ? Effect.succeed(bundles[0])
                : Effect.fail(
                    createYoutubeError(
                      "videos.list",
                      `No YouTube video was returned for video ID "${options.videoId}".`,
                    ),
                  ),
            ),
          ),
        readChannelVideos: (options) =>
          Effect.gen(function* () {
            const { channel, videos } = yield* loadChannelVideoSummaries(options);
            const bundles = yield* loadVideoBundles({
              videoIds: videos.map((video) => video.videoId),
              includeComments: options?.includeComments,
              commentsPerVideo: options?.commentsPerVideo,
            });

            return {
              channel,
              videos: bundles,
            };
          }),
      });
    }),
  );
}

export const layer = YoutubeReader.layer.pipe(Layer.provide(YoutubeReadConfig.layer));

export const program = Effect.gen(function* () {
  const youtube = yield* YoutubeReader;
  const output = yield* youtube.readChannelVideos({
    limit: 3,
    sort: "newest",
    includeComments: true,
    commentsPerVideo: 20,
  });

  yield* Effect.sync(() => {
    console.log(JSON.stringify(output, null, 2));
  });
}).pipe(Effect.provide(layer));

if (isDirectExecution(import.meta.url)) {
  runNodeMain(program);
}
