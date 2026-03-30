import "@ns-sentinel/core/register-env";
import { Effect, Layer } from "effect";
import { isDirectExecution, runNodeMain } from "@ns-sentinel/core";
import { listYoutubeChannels, syncLatestYoutubeVideos } from "@ns-sentinel/crawl-helpers";
import { layer as databaseLayer } from "@ns-sentinel/db";
import { layer as youtubeLayer } from "@ns-sentinel/youtube-read";

type LiveCrawlerConfig = {
  readonly latestVideoLimit: number;
  readonly commentsPerVideo: number;
  readonly pollIntervalMs: number;
};

const parseNumberEnv = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
};

const loadConfig = (): LiveCrawlerConfig => {
  return {
    latestVideoLimit: parseNumberEnv(process.env.YOUTUBE_LIVE_CRAWLER_VIDEO_LIMIT, 20),
    commentsPerVideo: parseNumberEnv(process.env.YOUTUBE_LIVE_CRAWLER_COMMENTS_PER_VIDEO, 200),
    pollIntervalMs: parseNumberEnv(process.env.YOUTUBE_LIVE_CRAWLER_POLL_INTERVAL_MS, 900000),
  };
};

const log = (
  message: string,
  details: Record<string, string | number | boolean | null | undefined> = {},
) => {
  console.log(
    JSON.stringify({
      details,
      message,
      scope: "live-crawler",
      timestamp: new Date().toISOString(),
    }),
  );
};

const crawlChannel = (options: {
  readonly channel: {
    readonly name: string;
    readonly ytChannelId: string;
  };
  readonly channelIndex: number;
  readonly totalChannels: number;
  readonly config: LiveCrawlerConfig;
}) =>
  Effect.gen(function* () {
    log("Starting channel crawl", {
      channelIndex: options.channelIndex + 1,
      totalChannels: options.totalChannels,
      channelName: options.channel.name,
      requestedChannelId: options.channel.ytChannelId,
    });

    const result = yield* syncLatestYoutubeVideos({
      channelId: options.channel.ytChannelId,
      limit: options.config.latestVideoLimit,
      commentsPerVideo: options.config.commentsPerVideo,
    }).pipe(
      Effect.tapError((error) =>
        Effect.sync(() => {
          log("Channel crawl failed", {
            channelIndex: options.channelIndex + 1,
            totalChannels: options.totalChannels,
            channelName: options.channel.name,
            requestedChannelId: options.channel.ytChannelId,
            errorMessage: error.message,
          });
        }),
      ),
    );

    log("Completed channel crawl", {
      channelIndex: options.channelIndex + 1,
      totalChannels: options.totalChannels,
      channelName: options.channel.name,
      requestedChannelId: options.channel.ytChannelId,
      discoveredCount: result.discoveredCount,
      insertedCount: result.insertedCount,
      updatedCount: result.updatedCount,
      commentSyncedVideoCount: result.commentSyncedVideoCount,
    });

    return {
      requestedChannelId: options.channel.ytChannelId,
      ...result,
    };
  });

const runCrawlerPass = (config: LiveCrawlerConfig) =>
  Effect.gen(function* () {
    const channels = yield* listYoutubeChannels;
    const results = yield* Effect.forEach(
      channels.map((channel, channelIndex) => ({
        channel,
        channelIndex,
      })),
      ({ channel, channelIndex }) =>
        crawlChannel({
          channel,
          channelIndex,
          totalChannels: channels.length,
          config,
        }),
      { concurrency: 3 },
    );

    yield* Effect.sync(() => {
      console.log(
        JSON.stringify(
          {
            ranAt: new Date().toISOString(),
            results,
            crawledChannelCount: channels.length,
          },
          null,
          2,
        ),
      );
    });
  });

const crawlerLayer = Layer.mergeAll(databaseLayer, youtubeLayer);

export const program = Effect.gen(function* () {
  const config = loadConfig();

  while (true) {
    yield* Effect.catchCause(runCrawlerPass(config), () =>
      Effect.sync(() => {
        console.error(
          JSON.stringify(
            {
              ranAt: new Date().toISOString(),
              status: "failed",
            },
            null,
            2,
          ),
        );
      }),
    );

    yield* Effect.sleep(config.pollIntervalMs);
  }
}).pipe(Effect.provide(crawlerLayer));

if (isDirectExecution(import.meta.url)) {
  runNodeMain(program);
}
