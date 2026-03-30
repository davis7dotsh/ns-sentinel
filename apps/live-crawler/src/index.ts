import { Effect, Layer } from "effect";
import { isDirectExecution, runNodeMain } from "@ns-sentinel/core";
import {
  listYoutubeChannels,
  syncLatestYoutubeVideos,
} from "@ns-sentinel/crawl-helpers";
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
    latestVideoLimit: parseNumberEnv(
      process.env.YOUTUBE_LIVE_CRAWLER_VIDEO_LIMIT,
      20,
    ),
    commentsPerVideo: parseNumberEnv(
      process.env.YOUTUBE_LIVE_CRAWLER_COMMENTS_PER_VIDEO,
      200,
    ),
    pollIntervalMs: parseNumberEnv(
      process.env.YOUTUBE_LIVE_CRAWLER_POLL_INTERVAL_MS,
      900000,
    ),
  };
};

const runCrawlerPass = (config: LiveCrawlerConfig) =>
  Effect.gen(function* () {
    const channels = yield* listYoutubeChannels;
    const results: Array<{
      readonly requestedChannelId: string;
      readonly channelId: string;
      readonly discoveredCount: number;
      readonly insertedCount: number;
      readonly updatedCount: number;
      readonly commentSyncedVideoCount: number;
    }> = [];

    for (const channel of channels) {
      const result = yield* syncLatestYoutubeVideos({
        channelId: channel.ytChannelId,
        limit: config.latestVideoLimit,
        commentsPerVideo: config.commentsPerVideo,
      });

      results.push({
        requestedChannelId: channel.ytChannelId,
        ...result,
      });
    }

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
