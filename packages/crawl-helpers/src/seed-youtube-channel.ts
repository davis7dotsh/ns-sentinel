import "@ns-sentinel/core/register-env";
import { Effect, Layer } from "effect";
import { isDirectExecution, runNodeMain } from "@ns-sentinel/core";
import { layer as databaseLayer } from "@ns-sentinel/db";
import { layer as youtubeLayer } from "@ns-sentinel/youtube-read";

import { seedYoutubeChannel } from "./index.ts";

const crawlerLayer = Layer.mergeAll(databaseLayer, youtubeLayer);
const defaultChannel = "https://www.youtube.com/@bmdavis419";

export const program = Effect.gen(function* () {
  const result = yield* seedYoutubeChannel(process.env.YOUTUBE_SEED_CHANNEL_URL ?? defaultChannel);

  yield* Effect.sync(() => {
    console.log(JSON.stringify(result, null, 2));
  });
}).pipe(Effect.provide(crawlerLayer));

if (isDirectExecution(import.meta.url)) {
  runNodeMain(program);
}
