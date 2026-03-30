/**
 * Getting started:
 * 1. Create a Slack app at api.slack.com/apps.
 * 2. Add bot token scopes for the read surface you want. For this hello-world example, `channels:read` is enough.
 * 3. Install the app to your workspace and export `SLACK_BOT_TOKEN`.
 * 4. Optionally export `SLACK_CHANNEL_ID` if you also want this script to read recent messages from one public channel.
 */

import { WebClient } from "@slack/web-api";
import { Config, Effect, Layer, Option, ServiceMap } from "effect";
import {
  createSentinelError,
  isDirectExecution,
  runNodeMain,
  withEnvConfig,
} from "@ns-sentinel/core";

const SlackConfigSource = Config.all({
  botToken: Config.string("SLACK_BOT_TOKEN"),
  channelId: Config.option(Config.string("SLACK_CHANNEL_ID")),
});

export class SlackReadConfig extends ServiceMap.Service<
  SlackReadConfig,
  {
    readonly botToken: string;
    readonly channelId: Option.Option<string>;
  }
>()("SlackReadConfig", {
  make: withEnvConfig(SlackConfigSource.asEffect()),
}) {
  static readonly layer = Layer.effect(this)(this.make);
}

export class SlackReader extends ServiceMap.Service<
  SlackReader,
  {
    readonly readWorkspace: () => Effect.Effect<
      {
        readonly team: string | undefined;
        readonly teamId: string | undefined;
        readonly botUserId: string | undefined;
        readonly channels: readonly {
          readonly id: string | undefined;
          readonly name: string | undefined;
          readonly isPrivate: boolean;
          readonly isShared: boolean;
          readonly isExtShared: boolean;
          readonly isOrgShared: boolean;
        }[];
        readonly history?: readonly {
          readonly user: string | undefined;
          readonly text: string | undefined;
          readonly ts: string | undefined;
        }[];
      },
      ReturnType<typeof createSentinelError>
    >;
  }
>()("SlackReader") {
  static readonly layer = Layer.effect(this)(
    Effect.gen(function* () {
      const config = yield* SlackReadConfig;
      const slack = new WebClient(config.botToken);

      const listAllChannels = Effect.gen(function* () {
        const channels = [];
        let cursor: string | undefined;

        do {
          const response = yield* Effect.tryPromise({
            try: () =>
              slack.conversations.list({
                limit: 200,
                exclude_archived: true,
                types: "public_channel,private_channel",
                cursor,
              }),
            catch: (cause) =>
              createSentinelError({
                module: "@ns-sentinel/slack-read",
                operation: "listChannels",
                message: "Failed to list Slack channels.",
                cause,
              }),
          });

          channels.push(...(response.channels ?? []));
          cursor = response.response_metadata?.next_cursor || undefined;
        } while (cursor);

        return channels;
      });

      return SlackReader.of({
        readWorkspace: () =>
          Effect.gen(function* () {
            const auth = yield* Effect.tryPromise({
              try: () => slack.auth.test(),
              catch: (cause) =>
                createSentinelError({
                  module: "@ns-sentinel/slack-read",
                  operation: "authTest",
                  message: "Failed to verify the Slack bot token.",
                  cause,
                }),
            });

            const channels = yield* listAllChannels;

            const output = {
              team: auth.team,
              teamId: auth.team_id,
              botUserId: auth.user_id,
              channels: channels.map((channel) => ({
                id: channel.id,
                name: channel.name,
                isPrivate: channel.is_private ?? false,
                isShared: channel.is_shared ?? false,
                isExtShared: channel.is_ext_shared ?? false,
                isOrgShared: channel.is_org_shared ?? false,
              })),
            };

            return yield* Option.match(config.channelId, {
              onNone: () => Effect.succeed(output),
              onSome: (channelId) =>
                Effect.gen(function* () {
                  const history = yield* Effect.tryPromise({
                    try: () =>
                      slack.conversations.history({
                        channel: channelId,
                        limit: 10,
                      }),
                    catch: (cause) =>
                      createSentinelError({
                        module: "@ns-sentinel/slack-read",
                        operation: "history",
                        message: "Failed to load Slack channel history.",
                        cause,
                      }),
                  });

                  return {
                    ...output,
                    history: (history.messages ?? []).map((message) => ({
                      user: message.user,
                      text: message.text,
                      ts: message.ts,
                    })),
                  };
                }),
            });
          }),
      });
    }),
  );
}

export const layer = SlackReader.layer.pipe(Layer.provide(SlackReadConfig.layer));

export const program = Effect.gen(function* () {
  const slack = yield* SlackReader;
  const output = yield* slack.readWorkspace();

  yield* Effect.sync(() => {
    console.log(JSON.stringify(output, null, 2));
  });
}).pipe(Effect.provide(layer));

if (isDirectExecution(import.meta.url)) {
  runNodeMain(program);
}
