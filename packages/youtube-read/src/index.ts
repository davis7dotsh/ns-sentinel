/**
 * Getting started:
 * 1. In Google Cloud, create or reuse a project and enable the YouTube Data API v3.
 * 2. Create an API key in Google Cloud Credentials and export it as `YOUTUBE_API_KEY`.
 * 3. Optionally export `YOUTUBE_CHANNEL_ID` to look up a specific public channel directly.
 * 4. Otherwise this script uses `YOUTUBE_QUERY` (default: `Google for Developers`) to find a public channel, then loads its public stats.
 */

import { google } from "googleapis";
import { Config, Effect, Layer, Option, ServiceMap } from "effect";
import {
  createSentinelError,
  runNodeMain,
  withEnvConfig,
} from "@ns-sentinel/core";

const YoutubeConfigSource = Config.all({
  apiKey: Config.string("YOUTUBE_API_KEY"),
  channelId: Config.option(Config.string("YOUTUBE_CHANNEL_ID")),
  query: Config.string("YOUTUBE_QUERY").pipe(
    Config.withDefault("Google for Developers"),
  ),
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
    readonly readChannel: () => Effect.Effect<
      {
        readonly id: string | undefined;
        readonly query: string;
        readonly title: string | undefined;
        readonly description: string | undefined;
        readonly customUrl: string | undefined;
        readonly publishedAt: string | undefined;
        readonly viewCount: string | undefined;
        readonly subscriberCount: string | undefined;
        readonly videoCount: string | undefined;
      },
      ReturnType<typeof createSentinelError>
    >;
  }
>()("YoutubeReader") {
  static readonly layer = Layer.effect(this)(
    Effect.gen(function* () {
      const config = yield* YoutubeReadConfig;
      const youtube = google.youtube({ version: "v3", auth: config.apiKey });

      const resolveChannelId = Effect.gen(function* () {
        if (Option.isSome(config.channelId)) {
          return config.channelId.value;
        }

        const searchResponse = yield* Effect.tryPromise({
          try: () =>
            youtube.search.list({
              q: config.query,
              type: ["channel"],
              maxResults: 1,
              part: ["snippet"],
            }),
          catch: (cause) =>
            createSentinelError({
              module: "@ns-sentinel/youtube-read",
              operation: "search",
              message: "Failed to search for a YouTube channel.",
              cause,
            }),
        });

        const channelId = searchResponse.data.items?.[0]?.id?.channelId;

        if (!channelId) {
          return yield* Effect.fail(
            createSentinelError({
              module: "@ns-sentinel/youtube-read",
              operation: "search",
              message: `No public YouTube channel was found for query "${config.query}".`,
            }),
          );
        }

        return channelId;
      });

      return YoutubeReader.of({
        readChannel: () =>
          Effect.gen(function* () {
            const channelId = yield* resolveChannelId;
            const response = yield* Effect.tryPromise({
              try: () =>
                youtube.channels.list({
                  id: [channelId],
                  part: ["snippet", "statistics"],
                }),
              catch: (cause) =>
                createSentinelError({
                  module: "@ns-sentinel/youtube-read",
                  operation: "channels.list",
                  message: "Failed to load the YouTube channel details.",
                  cause,
                }),
            });

            const channel = response.data.items?.[0];

            if (!channel) {
              return yield* Effect.fail(
                createSentinelError({
                  module: "@ns-sentinel/youtube-read",
                  operation: "channels.list",
                  message: `No YouTube channel was returned for channel ID "${channelId}".`,
                }),
              );
            }

            return {
              id: channel.id ?? undefined,
              query: config.query,
              title: channel.snippet?.title ?? undefined,
              description: channel.snippet?.description ?? undefined,
              customUrl: channel.snippet?.customUrl ?? undefined,
              publishedAt: channel.snippet?.publishedAt ?? undefined,
              viewCount: channel.statistics?.viewCount ?? undefined,
              subscriberCount: channel.statistics?.subscriberCount ?? undefined,
              videoCount: channel.statistics?.videoCount ?? undefined,
            };
          }),
      });
    }),
  );
}

export const layer = YoutubeReader.layer.pipe(
  Layer.provide(YoutubeReadConfig.layer),
);

export const program = Effect.gen(function* () {
  const youtube = yield* YoutubeReader;
  const output = yield* youtube.readChannel();

  yield* Effect.sync(() => {
    console.log(JSON.stringify(output, null, 2));
  });
}).pipe(Effect.provide(layer));

runNodeMain(program);
