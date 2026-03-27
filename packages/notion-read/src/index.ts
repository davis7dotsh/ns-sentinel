/**
 * Getting started:
 * 1. Create an internal integration in Notion and grant it only the "Read content" capability.
 * 2. Share the specific page or data source you want this script to read with that integration.
 * 3. Export `NOTION_TOKEN` with the integration secret.
 * 4. Optionally export `NOTION_PAGE_ID` to retrieve one page directly, or `NOTION_QUERY` to narrow the search example.
 */

import { Client } from "@notionhq/client";
import { Config, Effect, Layer, Option, ServiceMap } from "effect";
import {
  createSentinelError,
  runNodeMain,
  withEnvConfig,
} from "@ns-sentinel/core";

const NotionConfigSource = Config.all({
  token: Config.string("NOTION_TOKEN"),
  pageId: Config.option(Config.string("NOTION_PAGE_ID")),
  query: Config.option(Config.string("NOTION_QUERY")),
});

export class NotionReadConfig extends ServiceMap.Service<
  NotionReadConfig,
  {
    readonly token: string;
    readonly pageId: Option.Option<string>;
    readonly query: Option.Option<string>;
  }
>()("NotionReadConfig", {
  make: withEnvConfig(NotionConfigSource.asEffect()),
}) {
  static readonly layer = Layer.effect(this)(this.make);
}

export class NotionReader extends ServiceMap.Service<
  NotionReader,
  {
    readonly read: () => Effect.Effect<
      {
        readonly mode: "page" | "search";
        readonly query?: string;
        readonly object?: string;
        readonly id?: string;
        readonly url?: string;
        readonly results?: readonly {
          readonly object: string;
          readonly id: string;
          readonly url?: string;
        }[];
      },
      ReturnType<typeof createSentinelError>
    >;
  }
>()("NotionReader") {
  static readonly layer = Layer.effect(this)(
    Effect.gen(function* () {
      const config = yield* NotionReadConfig;
      const notion = new Client({ auth: config.token });

      return NotionReader.of({
        read: () =>
          Effect.gen(function* () {
            return yield* Option.match(config.pageId, {
              onNone: () =>
                Effect.gen(function* () {
                  const response = yield* Effect.tryPromise({
                    try: () =>
                      notion.search({
                        query: Option.getOrUndefined(config.query),
                        filter: {
                          property: "object",
                          value: "page",
                        },
                        page_size: 5,
                      }),
                    catch: (cause) =>
                      createSentinelError({
                        module: "@ns-sentinel/notion-read",
                        operation: "search",
                        message: "Failed to search Notion pages.",
                        cause,
                      }),
                  });

                  return {
                    mode: "search" as const,
                    query: Option.getOrElse(config.query, () => ""),
                    results: response.results.map((result) => ({
                      object: result.object,
                      id: result.id,
                      url: "url" in result ? result.url : undefined,
                    })),
                  };
                }),
              onSome: (pageId) =>
                Effect.gen(function* () {
                  const page = yield* Effect.tryPromise({
                    try: () => notion.pages.retrieve({ page_id: pageId }),
                    catch: (cause) =>
                      createSentinelError({
                        module: "@ns-sentinel/notion-read",
                        operation: "retrievePage",
                        message:
                          "Failed to retrieve the requested Notion page.",
                        cause,
                      }),
                  });

                  return {
                    mode: "page" as const,
                    object: page.object,
                    id: page.id,
                    url: "url" in page ? page.url : undefined,
                  };
                }),
            });
          }),
      });
    }),
  );
}

export const layer = NotionReader.layer.pipe(
  Layer.provide(NotionReadConfig.layer),
);

export const program = Effect.gen(function* () {
  const notion = yield* NotionReader;
  const output = yield* notion.read();

  yield* Effect.sync(() => {
    console.log(JSON.stringify(output, null, 2));
  });
}).pipe(Effect.provide(layer));

runNodeMain(program);
