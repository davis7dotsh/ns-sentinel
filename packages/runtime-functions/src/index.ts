import { Data, Effect, Schema } from "effect";
import { Database, desc, eq, inArray, layer as databaseLayer, schema } from "@ns-sentinel/db";

class RuntimeFunctionNotFoundError extends Data.TaggedError("RuntimeFunctionNotFoundError")<{
  readonly functionName: string;
}> {}

class RuntimeFunctionValidationError extends Data.TaggedError("RuntimeFunctionValidationError")<{
  readonly functionName: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

class RuntimeFunctionExecutionError extends Data.TaggedError("RuntimeFunctionExecutionError")<{
  readonly functionName: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

type RuntimeFunctionArgField = {
  readonly name: string;
  readonly description: string;
  readonly type: "number" | "string";
  readonly required: boolean;
  readonly defaultValue?: string;
};

type RuntimeFunctionMetadata = {
  readonly name: string;
  readonly description: string;
  readonly args: readonly RuntimeFunctionArgField[];
  readonly returns: string;
};

type RuntimeFunctionDefinition<TArgs, TResult> = {
  readonly name: string;
  readonly description: string;
  readonly args: readonly RuntimeFunctionArgField[];
  readonly argsSchema: Schema.Schema<TArgs>;
  readonly resultSchema: Schema.Schema<TResult>;
  readonly decodeArgs: (args: unknown) => TArgs;
  readonly returns: string;
  readonly impl: (
    args: TArgs,
  ) => Effect.Effect<
    TResult,
    RuntimeFunctionExecutionError | RuntimeFunctionValidationError,
    Database
  >;
};

type RuntimeFunctionExample = {
  readonly name: string;
  readonly description: string;
  readonly args: unknown;
  readonly result: unknown;
};

type GetChannelsArgs = {
  readonly limit?: number;
  readonly offset?: number;
};

type ChannelSummary = {
  readonly avatarUrl: string | null;
  readonly bannerUrl: string | null;
  readonly description: string | null;
  readonly id: string;
  readonly lastXSyncedAt: string | null;
  readonly lastYoutubeSyncedAt: string | null;
  readonly name: string;
  readonly subscriberCount: string | null;
  readonly totalViewCount: string | null;
  readonly videoCount: number | null;
  readonly xUsername: string | null;
  readonly ytChannelId: string;
  readonly ytCustomUrl: string | null;
  readonly youtubeUrl: string;
};

type GetVideosArgs = {
  readonly channelId?: string;
  readonly limit?: number;
  readonly offset?: number;
};

type VideoSummary = {
  readonly channelId: string;
  readonly commentCount: string | null;
  readonly contentKind: string | null;
  readonly description: string | null;
  readonly durationSeconds: number | null;
  readonly id: string;
  readonly likeCount: string | null;
  readonly publishedAt: string;
  readonly thumbnailUrl: string | null;
  readonly title: string;
  readonly viewCount: string | null;
  readonly youtubeUrl: string;
  readonly ytVideoId: string;
};

type GetCommentsArgs = {
  readonly limit?: number;
  readonly offset?: number;
  readonly videoId: string;
};

type CommentSummary = {
  readonly authorChannelId: string | null;
  readonly authorChannelUrl: string | null;
  readonly authorDisplayName: string | null;
  readonly bodyText: string;
  readonly id: string;
  readonly likeCount: string | null;
  readonly publishedAt: string;
  readonly replyCount: number | null;
  readonly videoId: string;
  readonly youtubeUrl: string;
  readonly ytCommentId: string;
};

type RuntimeFunctionFailure =
  | RuntimeFunctionExecutionError
  | RuntimeFunctionNotFoundError
  | RuntimeFunctionValidationError;

const defaultLimit = 12;
const maxLimit = 50;

const toDisplayCount = (value: bigint | null | undefined) =>
  value === null || value === undefined ? null : value.toString();

const toIsoString = (value: Date | null | undefined) => (value ? value.toISOString() : null);

const getYoutubeChannelUrl = (channel: {
  readonly ytCustomUrl: string | null;
  readonly ytChannelId: string;
}) =>
  channel.ytCustomUrl
    ? `https://www.youtube.com/${channel.ytCustomUrl.replace(/^@?/u, "@")}`
    : `https://www.youtube.com/channel/${channel.ytChannelId}`;

const getYoutubeVideoUrl = (ytVideoId: string) => `https://www.youtube.com/watch?v=${ytVideoId}`;

const getYoutubeCommentUrl = (ytVideoId: string, ytCommentId: string) =>
  `${getYoutubeVideoUrl(ytVideoId)}&lc=${ytCommentId}`;

const getYoutubeAuthorChannelUrl = (authorChannelId: string | null) =>
  authorChannelId ? `https://www.youtube.com/channel/${authorChannelId}` : null;

const normalizeLimit = (value: number | undefined) => {
  if (value === undefined) {
    return defaultLimit;
  }

  return Math.min(maxLimit, Math.max(1, Math.floor(value)));
};

const normalizeOffset = (value: number | undefined) => {
  if (value === undefined) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
};

const normalizeOptionalId = (value: string | undefined) => {
  const trimmed = value?.trim();

  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const normalizeRequiredId = (input: { readonly functionName: string; readonly value: string }) =>
  Effect.sync(() => input.value.trim()).pipe(
    Effect.flatMap((trimmed) =>
      trimmed.length > 0
        ? Effect.succeed(trimmed)
        : Effect.fail(
            new RuntimeFunctionValidationError({
              functionName: input.functionName,
              message: `${input.functionName} requires a non-empty identifier.`,
            }),
          ),
    ),
  );

const runRuntimeFunctionEffect = <A>(effect: Effect.Effect<A, RuntimeFunctionFailure, Database>) =>
  Effect.runPromise(effect.pipe(Effect.provide(databaseLayer)));

const decodeRuntimeFunctionArgs = <TArgs>(
  definition: Pick<RuntimeFunctionDefinition<TArgs, unknown>, "decodeArgs" | "name">,
  args: unknown,
) =>
  Effect.try({
    try: () => definition.decodeArgs(args),
    catch: (cause) =>
      new RuntimeFunctionValidationError({
        functionName: definition.name,
        message: `Invalid arguments for "${definition.name}".`,
        cause,
      }),
  });

const ChannelSummarySchema: Schema.Schema<ChannelSummary> = Schema.Struct({
  avatarUrl: Schema.NullOr(Schema.String),
  bannerUrl: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  id: Schema.String,
  lastXSyncedAt: Schema.NullOr(Schema.String),
  lastYoutubeSyncedAt: Schema.NullOr(Schema.String),
  name: Schema.String,
  subscriberCount: Schema.NullOr(Schema.String),
  totalViewCount: Schema.NullOr(Schema.String),
  videoCount: Schema.NullOr(Schema.Number),
  xUsername: Schema.NullOr(Schema.String),
  ytChannelId: Schema.String,
  ytCustomUrl: Schema.NullOr(Schema.String),
  youtubeUrl: Schema.String,
});

const VideoSummarySchema: Schema.Schema<VideoSummary> = Schema.Struct({
  channelId: Schema.String,
  commentCount: Schema.NullOr(Schema.String),
  contentKind: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  durationSeconds: Schema.NullOr(Schema.Number),
  id: Schema.String,
  likeCount: Schema.NullOr(Schema.String),
  publishedAt: Schema.String,
  thumbnailUrl: Schema.NullOr(Schema.String),
  title: Schema.String,
  viewCount: Schema.NullOr(Schema.String),
  youtubeUrl: Schema.String,
  ytVideoId: Schema.String,
});

const CommentSummarySchema: Schema.Schema<CommentSummary> = Schema.Struct({
  authorChannelId: Schema.NullOr(Schema.String),
  authorChannelUrl: Schema.NullOr(Schema.String),
  authorDisplayName: Schema.NullOr(Schema.String),
  bodyText: Schema.String,
  id: Schema.String,
  likeCount: Schema.NullOr(Schema.String),
  publishedAt: Schema.String,
  replyCount: Schema.NullOr(Schema.Number),
  videoId: Schema.String,
  youtubeUrl: Schema.String,
  ytCommentId: Schema.String,
});

const getChannelsDefinition: RuntimeFunctionDefinition<GetChannelsArgs, readonly ChannelSummary[]> =
  {
    name: "getChannels",
    description:
      "List YouTube channels from the local Postgres database, ordered by most recently synced YouTube data.",
    args: [
      {
        defaultValue: "12",
        description: "Maximum number of channels to return.",
        name: "limit",
        required: false,
        type: "number",
      },
      {
        defaultValue: "0",
        description: "Zero-based offset for pagination.",
        name: "offset",
        required: false,
        type: "number",
      },
    ],
    argsSchema: Schema.Struct({
      limit: Schema.optional(Schema.Number),
      offset: Schema.optional(Schema.Number),
    }),
    decodeArgs: Schema.decodeUnknownSync(
      Schema.Struct({
        limit: Schema.optional(Schema.Number),
        offset: Schema.optional(Schema.Number),
      }),
    ),
    resultSchema: Schema.Array(ChannelSummarySchema),
    returns:
      "An array of channel summaries including names, IDs, social handles, sync timestamps, and headline metrics.",
    impl: (args) =>
      Effect.gen(function* () {
        const database = yield* Database;
        const channels = yield* Effect.tryPromise({
          try: () =>
            database.db.query.channels.findMany({
              limit: normalizeLimit(args.limit),
              offset: normalizeOffset(args.offset),
              orderBy: (channels, { desc }) => [desc(channels.lastYoutubeSyncedAt)],
            }),
          catch: (cause) =>
            new RuntimeFunctionExecutionError({
              functionName: "getChannels",
              message: "Failed to load channels from Postgres.",
              cause,
            }),
        });

        return channels.map((channel) => ({
          avatarUrl: channel.avatarUrl,
          bannerUrl: channel.bannerUrl,
          description: channel.description,
          id: channel.id,
          lastXSyncedAt: toIsoString(channel.lastXSyncedAt),
          lastYoutubeSyncedAt: toIsoString(channel.lastYoutubeSyncedAt),
          name: channel.name,
          subscriberCount: toDisplayCount(channel.subscriberCount),
          totalViewCount: toDisplayCount(channel.totalViewCount),
          videoCount: channel.videoCount,
          xUsername: channel.xUsername,
          ytChannelId: channel.ytChannelId,
          ytCustomUrl: channel.ytCustomUrl,
          youtubeUrl: getYoutubeChannelUrl(channel),
        }));
      }),
  };

const getVideosDefinition: RuntimeFunctionDefinition<GetVideosArgs, readonly VideoSummary[]> = {
  name: "getVideos",
  description:
    "List YouTube videos from the local Postgres database, optionally filtered to one channel, ordered by newest publish date.",
  args: [
    {
      description: "Optional channel ID to filter videos to a single channel.",
      name: "channelId",
      required: false,
      type: "string",
    },
    {
      defaultValue: "12",
      description: "Maximum number of videos to return.",
      name: "limit",
      required: false,
      type: "number",
    },
    {
      defaultValue: "0",
      description: "Zero-based offset for pagination.",
      name: "offset",
      required: false,
      type: "number",
    },
  ],
  argsSchema: Schema.Struct({
    channelId: Schema.optional(Schema.String),
    limit: Schema.optional(Schema.Number),
    offset: Schema.optional(Schema.Number),
  }),
  decodeArgs: Schema.decodeUnknownSync(
    Schema.Struct({
      channelId: Schema.optional(Schema.String),
      limit: Schema.optional(Schema.Number),
      offset: Schema.optional(Schema.Number),
    }),
  ),
  resultSchema: Schema.Array(VideoSummarySchema),
  returns:
    "An array of video summaries including publish date, thumbnail, YouTube URL, and latest metric snapshot counts.",
  impl: (args) =>
    Effect.gen(function* () {
      const database = yield* Database;
      const normalizedChannelId = normalizeOptionalId(args.channelId);
      const videos = yield* Effect.tryPromise({
        try: () =>
          database.db.query.ytVideos.findMany({
            limit: normalizeLimit(args.limit),
            offset: normalizeOffset(args.offset),
            orderBy: (ytVideos, { desc }) => [desc(ytVideos.publishedAt)],
            where: normalizedChannelId
              ? (ytVideos, { eq }) => eq(ytVideos.channelId, normalizedChannelId)
              : undefined,
          }),
        catch: (cause) =>
          new RuntimeFunctionExecutionError({
            functionName: "getVideos",
            message: "Failed to load videos from Postgres.",
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
                    capturedAt: schema.ytVideoMetricsSnapshots.capturedAt,
                    commentCount: schema.ytVideoMetricsSnapshots.commentCount,
                    likeCount: schema.ytVideoMetricsSnapshots.likeCount,
                    videoId: schema.ytVideoMetricsSnapshots.videoId,
                    viewCount: schema.ytVideoMetricsSnapshots.viewCount,
                  })
                  .from(schema.ytVideoMetricsSnapshots)
                  .where(inArray(schema.ytVideoMetricsSnapshots.videoId, videoIds))
                  .orderBy(
                    desc(schema.ytVideoMetricsSnapshots.capturedAt),
                    desc(schema.ytVideoMetricsSnapshots.videoId),
                  ),
              catch: (cause) =>
                new RuntimeFunctionExecutionError({
                  functionName: "getVideos",
                  message: "Failed to load video metrics from Postgres.",
                  cause,
                }),
            });

      const latestSnapshotByVideoId = new Map<
        string,
        {
          readonly commentCount: string | null;
          readonly likeCount: string | null;
          readonly viewCount: string | null;
        }
      >();

      for (const snapshot of snapshots) {
        if (latestSnapshotByVideoId.has(snapshot.videoId)) {
          continue;
        }

        latestSnapshotByVideoId.set(snapshot.videoId, {
          commentCount: toDisplayCount(snapshot.commentCount),
          likeCount: toDisplayCount(snapshot.likeCount),
          viewCount: toDisplayCount(snapshot.viewCount),
        });
      }

      return videos.map((video) => {
        const latestSnapshot = latestSnapshotByVideoId.get(video.id);

        return {
          channelId: video.channelId,
          commentCount: latestSnapshot?.commentCount ?? null,
          contentKind: video.contentKind,
          description: video.description,
          durationSeconds: video.durationSeconds,
          id: video.id,
          likeCount: latestSnapshot?.likeCount ?? null,
          publishedAt: video.publishedAt.toISOString(),
          thumbnailUrl: video.thumbnailUrl,
          title: video.title,
          viewCount: latestSnapshot?.viewCount ?? null,
          youtubeUrl: getYoutubeVideoUrl(video.ytVideoId),
          ytVideoId: video.ytVideoId,
        };
      });
    }),
};

const getCommentsDefinition: RuntimeFunctionDefinition<GetCommentsArgs, readonly CommentSummary[]> =
  {
    name: "getComments",
    description:
      "List YouTube comments for a specific video from the local Postgres database, ordered by most-liked comments first.",
    args: [
      {
        description: "Required internal video ID to load comments for.",
        name: "videoId",
        required: true,
        type: "string",
      },
      {
        defaultValue: "12",
        description: "Maximum number of comments to return.",
        name: "limit",
        required: false,
        type: "number",
      },
      {
        defaultValue: "0",
        description: "Zero-based offset for pagination.",
        name: "offset",
        required: false,
        type: "number",
      },
    ],
    argsSchema: Schema.Struct({
      limit: Schema.optional(Schema.Number),
      offset: Schema.optional(Schema.Number),
      videoId: Schema.String,
    }),
    decodeArgs: Schema.decodeUnknownSync(
      Schema.Struct({
        limit: Schema.optional(Schema.Number),
        offset: Schema.optional(Schema.Number),
        videoId: Schema.String,
      }),
    ),
    resultSchema: Schema.Array(CommentSummarySchema),
    returns:
      "An array of YouTube comment summaries including author info, body text, like counts, reply counts, and direct comment URLs.",
    impl: (args) =>
      Effect.gen(function* () {
        const database = yield* Database;
        const videoId = yield* normalizeRequiredId({
          functionName: "getComments",
          value: args.videoId,
        });
        const [video] = yield* Effect.tryPromise({
          try: () =>
            database.db
              .select({
                id: schema.ytVideos.id,
                ytVideoId: schema.ytVideos.ytVideoId,
              })
              .from(schema.ytVideos)
              .where(eq(schema.ytVideos.id, videoId))
              .limit(1),
          catch: (cause) =>
            new RuntimeFunctionExecutionError({
              functionName: "getComments",
              message: "Failed to load the requested video from Postgres.",
              cause,
            }),
        });

        if (!video) {
          return [];
        }

        const comments = yield* Effect.tryPromise({
          try: () =>
            database.db.query.ytComments.findMany({
              limit: normalizeLimit(args.limit),
              offset: normalizeOffset(args.offset),
              orderBy: (ytComments, { desc }) => [
                desc(ytComments.likeCount),
                desc(ytComments.publishedAt),
              ],
              where: (ytComments, { eq }) => eq(ytComments.videoId, videoId),
            }),
          catch: (cause) =>
            new RuntimeFunctionExecutionError({
              functionName: "getComments",
              message: "Failed to load comments from Postgres.",
              cause,
            }),
        });

        return comments.map((comment) => ({
          authorChannelId: comment.authorChannelId,
          authorChannelUrl: getYoutubeAuthorChannelUrl(comment.authorChannelId),
          authorDisplayName: comment.authorDisplayName,
          bodyText: comment.bodyText,
          id: comment.id,
          likeCount: toDisplayCount(comment.likeCount),
          publishedAt: comment.publishedAt.toISOString(),
          replyCount: comment.replyCount,
          videoId: comment.videoId,
          youtubeUrl: getYoutubeCommentUrl(video.ytVideoId, comment.ytCommentId),
          ytCommentId: comment.ytCommentId,
        }));
      }),
  };

const runtimeFunctionDefinitions = [
  getChannelsDefinition,
  getVideosDefinition,
  getCommentsDefinition,
] as const;

const runtimeFunctionMetadata = runtimeFunctionDefinitions.map((definition) => ({
  args: definition.args,
  description: definition.description,
  name: definition.name,
  returns: definition.returns,
})) satisfies readonly RuntimeFunctionMetadata[];

const executeRuntimeFunction = <TArgs, TResult>(
  definition: RuntimeFunctionDefinition<TArgs, TResult>,
  args: unknown,
) =>
  Effect.gen(function* () {
    const decodedArgs = yield* decodeRuntimeFunctionArgs(definition, args);
    const result = yield* definition.impl(decodedArgs);

    return result;
  });

export const getRuntimeFunctionMetadata = () => runtimeFunctionMetadata;

export const callRuntimeFunction = async (input: {
  readonly args: unknown;
  readonly name: string;
}) => {
  switch (input.name) {
    case "getChannels":
      return runRuntimeFunctionEffect(executeRuntimeFunction(getChannelsDefinition, input.args));
    case "getVideos":
      return runRuntimeFunctionEffect(executeRuntimeFunction(getVideosDefinition, input.args));
    case "getComments":
      return runRuntimeFunctionEffect(executeRuntimeFunction(getCommentsDefinition, input.args));
    default:
      throw new RuntimeFunctionNotFoundError({
        functionName: input.name,
      });
  }
};

export const getRuntimeFunctionModelContext = async () => {
  const examples: RuntimeFunctionExample[] = [];
  const channelsArgs = {
    limit: 2,
    offset: 0,
  };
  const videosArgs = {
    limit: 2,
    offset: 0,
  };
  const channelsResult = await callRuntimeFunction({
    args: channelsArgs,
    name: "getChannels",
  });

  examples.push({
    args: channelsArgs,
    description: getChannelsDefinition.description,
    name: "getChannels",
    result: channelsResult,
  });

  const videosResult = await callRuntimeFunction({
    args: videosArgs,
    name: "getVideos",
  });

  examples.push({
    args: videosArgs,
    description: getVideosDefinition.description,
    name: "getVideos",
    result: videosResult,
  });

  if (Array.isArray(videosResult) && videosResult.length > 0) {
    const firstVideo = videosResult[0];

    if (
      typeof firstVideo === "object" &&
      firstVideo !== null &&
      "id" in firstVideo &&
      typeof firstVideo.id === "string"
    ) {
      const commentsArgs = {
        limit: 2,
        offset: 0,
        videoId: firstVideo.id,
      };
      const commentsResult = await callRuntimeFunction({
        args: commentsArgs,
        name: "getComments",
      });

      examples.push({
        args: commentsArgs,
        description: getCommentsDefinition.description,
        name: "getComments",
        result: commentsResult,
      });
    }
  }

  return {
    examples,
    functions: getRuntimeFunctionMetadata(),
  };
};

export type {
  RuntimeFunctionArgField,
  RuntimeFunctionExample,
  RuntimeFunctionFailure,
  RuntimeFunctionMetadata,
};
