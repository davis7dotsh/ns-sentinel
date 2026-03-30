import { schedules } from "@trigger.dev/sdk";
import { Effect, Layer } from "effect";
import { loadWorkspaceEnv, withEnvConfig } from "@ns-sentinel/core";
import { listYoutubeChannels, syncLatestYoutubeVideos } from "@ns-sentinel/crawl-helpers";
import { layer as databaseLayer } from "@ns-sentinel/db";
import { layer as youtubeLayer } from "@ns-sentinel/youtube-read";

type LiveCrawlerConfig = {
  readonly latestVideoLimit: number;
  readonly commentsPerVideo: number;
};

const liveCrawlerTaskId = "youtube-live-crawler.sync-latest";
const liveCrawlerCron = "*/15 * * * *";

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
  };
};

const crawlerLayer = Layer.mergeAll(databaseLayer, youtubeLayer);

const logChannelProgress = (
  message: string,
  details: {
    readonly channelIndex: number;
    readonly totalChannels: number;
    readonly channelName: string;
    readonly requestedChannelId: string;
    readonly discoveredCount?: number;
    readonly insertedCount?: number;
    readonly updatedCount?: number;
    readonly commentSyncedVideoCount?: number;
    readonly errorMessage?: string;
  },
) => {
  log(message, details);
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
    logChannelProgress("Starting channel crawl", {
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
          logChannelProgress("Channel crawl failed", {
            channelIndex: options.channelIndex + 1,
            totalChannels: options.totalChannels,
            channelName: options.channel.name,
            requestedChannelId: options.channel.ytChannelId,
            errorMessage: error.message,
          });
        }),
      ),
    );

    logChannelProgress("Completed channel crawl", {
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

    return {
      crawledChannelCount: channels.length,
      results,
      ranAt: new Date().toISOString(),
    };
  });

const toErrorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : "Live crawler run failed.";

const log = (
  message: string,
  details: Record<string, string | number | boolean | null | undefined> = {},
) => {
  console.log(
    JSON.stringify({
      details,
      message,
      scope: liveCrawlerTaskId,
      timestamp: new Date().toISOString(),
    }),
  );
};

export const syncLatestYoutubeVideosTask = schedules.task({
  id: liveCrawlerTaskId,
  cron: liveCrawlerCron,
  maxDuration: 3_600,
  queue: {
    concurrencyLimit: 1,
  },
  run: async (payload) => {
    loadWorkspaceEnv();
    const config = loadConfig();

    log("Starting live crawler run", {
      commentsPerVideo: config.commentsPerVideo,
      lastTimestamp: payload.lastTimestamp?.toISOString(),
      latestVideoLimit: config.latestVideoLimit,
      scheduleId: payload.scheduleId,
      scheduledFor: payload.timestamp.toISOString(),
      timezone: payload.timezone,
    });

    try {
      const result = await Effect.runPromise(
        withEnvConfig(runCrawlerPass(config).pipe(Effect.provide(crawlerLayer))),
      );

      log("Completed live crawler run", {
        crawledChannelCount: result.crawledChannelCount,
        scheduleId: payload.scheduleId,
        scheduledFor: payload.timestamp.toISOString(),
      });

      console.log(
        JSON.stringify({
          ...result,
          lastTimestamp: payload.lastTimestamp?.toISOString(),
          scheduleId: payload.scheduleId,
          scheduledFor: payload.timestamp.toISOString(),
          timezone: payload.timezone,
        }),
      );

      return result;
    } catch (cause) {
      console.error(
        JSON.stringify({
          errorMessage: toErrorMessage(cause),
          lastTimestamp: payload.lastTimestamp?.toISOString(),
          scheduleId: payload.scheduleId,
          scheduledFor: payload.timestamp.toISOString(),
          scope: liveCrawlerTaskId,
          timestamp: new Date().toISOString(),
        }),
      );

      throw cause;
    }
  },
});
