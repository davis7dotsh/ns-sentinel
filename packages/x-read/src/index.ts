/**
 * Getting started:
 * 1. Create an app in the X Developer Console and generate a Bearer Token for app-only auth.
 * 2. Export `X_BEARER_TOKEN`.
 * 3. Optionally export `X_USERNAME` to override the default public account lookup.
 * 4. Optionally export `X_POST_ID_OR_URL` to exercise the post lookup program directly.
 */

import { Client } from "@xdevplatform/xdk";
import { Config, Effect, Layer, Option, ServiceMap } from "effect";
import {
  createSentinelError,
  isDirectExecution,
  runNodeMain,
  withEnvConfig,
} from "@ns-sentinel/core";

const XConfigSource = Config.all({
  bearerToken: Config.string("X_BEARER_TOKEN"),
  username: Config.string("X_USERNAME").pipe(Config.withDefault("XDevelopers")),
  postIdOrUrl: Config.option(Config.string("X_POST_ID_OR_URL")),
});

const xModule = "@ns-sentinel/x-read";
const xPostUrlPattern = /https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/iu;

type XApiResponse = Record<string, unknown>;

export type XUserRecord = {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly description: string | undefined;
  readonly verified: boolean | undefined;
  readonly createdAt: string | undefined;
  readonly publicMetrics: unknown;
};

export type XPostRecord = {
  readonly id: string;
  readonly authorId: string | undefined;
  readonly authorName: string | undefined;
  readonly authorUsername: string | undefined;
  readonly text: string;
  readonly lang: string | undefined;
  readonly conversationId: string | undefined;
  readonly inReplyToUserId: string | undefined;
  readonly quotedPostId: string | undefined;
  readonly repostedPostId: string | undefined;
  readonly createdAt: string | undefined;
  readonly publicMetrics: unknown;
  readonly hashtags: readonly string[];
  readonly mentions: readonly string[];
  readonly mediaUrls: readonly string[];
  readonly externalUrls: readonly string[];
  readonly metadata: XApiResponse;
};

const createXError = (operation: string, message: string, cause?: unknown) =>
  createSentinelError({
    module: xModule,
    operation,
    message,
    cause,
  });

const extractRecord = (value: unknown) =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;

const extractString = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const extractStringArray = (value: unknown) =>
  Array.isArray(value) ? value.flatMap((entry) => (typeof entry === "string" ? [entry] : [])) : [];

const extractPostIdFromInput = (input: string) => {
  const trimmed = input.trim();
  const matchedUrl = xPostUrlPattern.exec(trimmed);

  if (matchedUrl) {
    return matchedUrl[1];
  }

  return /^\d+$/u.test(trimmed) ? trimmed : undefined;
};

const findIncludedUser = (
  includes: Record<string, unknown> | undefined,
  authorId: string | undefined,
) => {
  if (!authorId || !includes) {
    return undefined;
  }

  const users = includes.users;

  if (!Array.isArray(users)) {
    return undefined;
  }

  return users.find((user) => extractRecord(user)?.id === authorId);
};

const collectMediaUrls = (
  includes: Record<string, unknown> | undefined,
  mediaKeys: readonly string[],
) => {
  if (mediaKeys.length === 0 || !includes) {
    return [] as string[];
  }

  const media = includes.media;

  if (!Array.isArray(media)) {
    return [] as string[];
  }

  const mediaByKey = new Map(
    media.flatMap((item) => {
      const record = extractRecord(item);
      const mediaKey = extractString(record?.media_key);

      return mediaKey ? [[mediaKey, record]] : [];
    }),
  );

  return mediaKeys.flatMap((mediaKey) => {
    const item = mediaByKey.get(mediaKey);

    if (!item) {
      return [];
    }

    return [extractString(item.url), extractString(item.preview_image_url)].flatMap((value) =>
      value ? [value] : [],
    );
  });
};

const normalizeXPost = (response: XApiResponse): XPostRecord | undefined => {
  const data = extractRecord(response.data);

  if (!data) {
    return undefined;
  }

  const id = extractString(data.id);
  const text = extractString(data.text);

  if (!id || !text) {
    return undefined;
  }

  const includes = extractRecord(response.includes);
  const authorId = extractString(data.author_id);
  const author = findIncludedUser(includes, authorId);
  const entities = extractRecord(data.entities);
  const attachments = extractRecord(data.attachments);

  const hashtags = Array.isArray(entities?.hashtags)
    ? entities.hashtags.flatMap((item) => {
        const tag = extractString(extractRecord(item)?.tag);

        return tag ? [tag] : [];
      })
    : [];
  const mentions = Array.isArray(entities?.mentions)
    ? entities.mentions.flatMap((item) => {
        const username = extractString(extractRecord(item)?.username);

        return username ? [username] : [];
      })
    : [];
  const externalUrls = Array.isArray(entities?.urls)
    ? entities.urls.flatMap((item) => {
        const record = extractRecord(item);
        const expandedUrl = extractString(record?.expanded_url);
        const url = extractString(record?.url);

        return expandedUrl ? [expandedUrl] : url ? [url] : [];
      })
    : [];
  const mediaUrls = collectMediaUrls(includes, extractStringArray(attachments?.media_keys));
  const referencedPosts = Array.isArray(data.referenced_tweets) ? data.referenced_tweets : [];
  const quotedPostId = referencedPosts.flatMap((item) => {
    const record = extractRecord(item);

    return record?.type === "quoted" ? [extractString(record.id)] : [];
  })[0];
  const repostedPostId = referencedPosts.flatMap((item) => {
    const record = extractRecord(item);

    return record?.type === "retweeted" ? [extractString(record.id)] : [];
  })[0];

  return {
    id,
    authorId,
    authorName: extractString(extractRecord(author)?.name),
    authorUsername: extractString(extractRecord(author)?.username),
    text,
    lang: extractString(data.lang),
    conversationId: extractString(data.conversation_id),
    inReplyToUserId: extractString(data.in_reply_to_user_id),
    quotedPostId,
    repostedPostId,
    createdAt: extractString(data.created_at),
    publicMetrics: data.public_metrics,
    hashtags,
    mentions,
    mediaUrls,
    externalUrls,
    metadata: response,
  };
};

export class XReadConfig extends ServiceMap.Service<
  XReadConfig,
  {
    readonly bearerToken: string;
    readonly username: string;
    readonly postIdOrUrl: string | undefined;
  }
>()("XReadConfig", {
  make: withEnvConfig(
    XConfigSource.asEffect().pipe(
      Effect.map((config) => ({
        bearerToken: config.bearerToken,
        username: config.username,
        postIdOrUrl: Option.getOrUndefined(config.postIdOrUrl),
      })),
    ),
  ),
}) {
  static readonly layer = Layer.effect(this)(this.make);
}

export class XReader extends ServiceMap.Service<
  XReader,
  {
    readonly readUser: (
      username?: string,
    ) => Effect.Effect<XUserRecord, ReturnType<typeof createSentinelError>>;
    readonly readPost: (input: {
      readonly idOrUrl: string;
    }) => Effect.Effect<XPostRecord, ReturnType<typeof createSentinelError>>;
  }
>()("XReader") {
  static readonly layer = Layer.effect(this)(
    Effect.gen(function* () {
      const config = yield* XReadConfig;
      const client = new Client({ bearerToken: config.bearerToken });

      return XReader.of({
        readUser: (username = config.username) =>
          Effect.gen(function* () {
            const response = yield* Effect.tryPromise({
              try: () =>
                client.users.getByUsername(username, {
                  userFields: ["description", "public_metrics", "verified", "created_at"],
                }),
              catch: (cause) =>
                createXError(
                  "users.getByUsername",
                  `Failed to fetch the X account "${username}".`,
                  cause,
                ),
            });

            if (!response.data) {
              return yield* Effect.fail(
                createXError(
                  "users.getByUsername",
                  `No X user was returned for username "${username}".`,
                ),
              );
            }

            return {
              id: response.data.id,
              name: response.data.name,
              username: response.data.username,
              description: response.data.description,
              verified: response.data.verified,
              createdAt: response.data.createdAt,
              publicMetrics: response.data.publicMetrics,
            };
          }),
        readPost: ({ idOrUrl }) =>
          Effect.gen(function* () {
            const postId = extractPostIdFromInput(idOrUrl);

            if (!postId) {
              return yield* Effect.fail(
                createXError("posts.getById", `Could not parse an X post ID from "${idOrUrl}".`),
              );
            }

            const response = yield* Effect.tryPromise({
              try: () =>
                client.posts.getById(postId, {
                  tweetFields: [
                    "attachments",
                    "author_id",
                    "conversation_id",
                    "created_at",
                    "entities",
                    "in_reply_to_user_id",
                    "lang",
                    "public_metrics",
                    "referenced_tweets",
                  ],
                  expansions: ["author_id", "attachments.media_keys"],
                  mediaFields: ["preview_image_url", "url"],
                  userFields: ["name", "username"],
                }),
              catch: (cause) =>
                createXError("posts.getById", `Failed to fetch the X post "${postId}".`, cause),
            });

            const normalized = normalizeXPost(response as XApiResponse);

            if (!normalized) {
              return yield* Effect.fail(
                createXError("posts.getById", `No X post data was returned for "${postId}".`),
              );
            }

            return normalized;
          }),
      });
    }),
  );
}

export const layer = Layer.mergeAll(
  XReadConfig.layer,
  XReader.layer.pipe(Layer.provide(XReadConfig.layer)),
);

export const program = Effect.gen(function* () {
  const x = yield* XReader;
  const config = yield* XReadConfig;
  const user = yield* x.readUser();

  if (!config.postIdOrUrl) {
    yield* Effect.sync(() => {
      console.log(JSON.stringify({ user }, null, 2));
    });

    return;
  }

  const post = yield* x.readPost({
    idOrUrl: config.postIdOrUrl,
  });

  yield* Effect.sync(() => {
    console.log(JSON.stringify({ user, post }, null, 2));
  });
}).pipe(Effect.provide(layer));

if (isDirectExecution(import.meta.url)) {
  runNodeMain(program);
}
