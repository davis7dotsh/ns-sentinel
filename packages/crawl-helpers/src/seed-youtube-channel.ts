import "@ns-sentinel/core/register-env";
import { Effect, Layer } from "effect";
import { isDirectExecution, runNodeMain } from "@ns-sentinel/core";
import { layer as databaseLayer } from "@ns-sentinel/db";
import { layer as youtubeLayer } from "@ns-sentinel/youtube-read";

import { seedYoutubeChannel } from "./index.ts";

const crawlerLayer = Layer.mergeAll(databaseLayer, youtubeLayer);
const defaultChannels = [
  "https://www.youtube.com/@bmdavis419",
  "https://www.youtube.com/@t3dotgg",
  "https://www.youtube.com/@rasmic",
  "https://www.youtube.com/@bigboxSWE",
  "https://www.youtube.com/@NeetCode",
  "https://www.youtube.com/@Acerola_t",
  "https://www.youtube.com/@LowLevelTV",
] as const;

const parseSeedChannelUrls = (value: string | undefined) =>
  value
    ?.split(/[\s,]+/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0) ?? [];

export const program = Effect.gen(function* () {
  const requestedChannels = [
    ...defaultChannels,
    ...parseSeedChannelUrls(process.env.YOUTUBE_SEED_CHANNEL_URL),
  ];
  const channelsToSeed = [...new Set(requestedChannels)];
  const results = yield* Effect.forEach(channelsToSeed, (channelUrl) =>
    seedYoutubeChannel(channelUrl),
  );

  yield* Effect.sync(() => {
    console.log(
      JSON.stringify(
        {
          seededChannelCount: results.length,
          results,
        },
        null,
        2,
      ),
    );
  });
}).pipe(Effect.provide(crawlerLayer));

if (isDirectExecution(import.meta.url)) {
  runNodeMain(program);
}
