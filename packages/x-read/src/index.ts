/**
 * Getting started:
 * 1. Create an app in the X Developer Console and generate a Bearer Token for app-only auth.
 * 2. Export `X_BEARER_TOKEN`.
 * 3. Optionally export `X_USERNAME` to override the default public account lookup.
 */

import { Client } from "@xdevplatform/xdk";
import { Config, Effect, Layer, ServiceMap } from "effect";
import {
  createSentinelError,
  runNodeMain,
  withEnvConfig,
} from "@ns-sentinel/core";

const XConfigSource = Config.all({
  bearerToken: Config.string("X_BEARER_TOKEN"),
  username: Config.string("X_USERNAME").pipe(Config.withDefault("XDevelopers")),
});

export class XReadConfig extends ServiceMap.Service<
  XReadConfig,
  {
    readonly bearerToken: string;
    readonly username: string;
  }
>()("XReadConfig", {
  make: withEnvConfig(XConfigSource.asEffect()),
}) {
  static readonly layer = Layer.effect(this)(this.make);
}

export class XReader extends ServiceMap.Service<
  XReader,
  {
    readonly readUser: () => Effect.Effect<
      {
        readonly id: string;
        readonly name: string;
        readonly username: string;
        readonly description: string | undefined;
        readonly verified: boolean | undefined;
        readonly createdAt: string | undefined;
        readonly publicMetrics: unknown;
      },
      ReturnType<typeof createSentinelError>
    >;
  }
>()("XReader") {
  static readonly layer = Layer.effect(this)(
    Effect.gen(function* () {
      const config = yield* XReadConfig;
      const client = new Client({ bearerToken: config.bearerToken });

      return XReader.of({
        readUser: () =>
          Effect.gen(function* () {
            const response = yield* Effect.tryPromise({
              try: () =>
                client.users.getByUsername(config.username, {
                  userFields: [
                    "description",
                    "public_metrics",
                    "verified",
                    "created_at",
                  ],
                }),
              catch: (cause) =>
                createSentinelError({
                  module: "@ns-sentinel/x-read",
                  operation: "getByUsername",
                  message: `Failed to fetch the X account "${config.username}".`,
                  cause,
                }),
            });

            if (!response.data) {
              return yield* Effect.fail(
                createSentinelError({
                  module: "@ns-sentinel/x-read",
                  operation: "getByUsername",
                  message: `No X user was returned for username "${config.username}".`,
                }),
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
      });
    }),
  );
}

export const layer = XReader.layer.pipe(Layer.provide(XReadConfig.layer));

export const program = Effect.gen(function* () {
  const x = yield* XReader;
  const output = yield* x.readUser();

  yield* Effect.sync(() => {
    console.log(JSON.stringify(output, null, 2));
  });
}).pipe(Effect.provide(layer));

runNodeMain(program);
