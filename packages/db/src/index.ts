import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { Config, Effect, Layer, ServiceMap } from "effect";
import { createSentinelError, makeNodeRuntime, withEnvConfig } from "@ns-sentinel/core";

import * as schema from "./schema";

export { schema };
export { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

export const defaultDatabaseUrl = "postgres://postgres:postgres@localhost:5432/ns_sentinel_dev";

const DatabaseConfigSource = Config.all({
  databaseUrl: Config.string("DATABASE_URL").pipe(Config.withDefault(defaultDatabaseUrl)),
});

const createDatabaseHandle = (databaseUrl: string) => {
  const client = postgres(databaseUrl, {
    max: 1,
  });

  return {
    client,
    db: drizzle(client, { schema }),
  };
};

type DatabaseHandle = ReturnType<typeof createDatabaseHandle>;

export class DatabaseConfig extends ServiceMap.Service<
  DatabaseConfig,
  {
    readonly databaseUrl: string;
  }
>()("DatabaseConfig", {
  make: withEnvConfig(DatabaseConfigSource.asEffect()),
}) {
  static readonly layer = Layer.effect(this)(this.make);
}

export class Database extends ServiceMap.Service<
  Database,
  {
    readonly client: DatabaseHandle["client"];
    readonly db: DatabaseHandle["db"];
    readonly ping: () => Effect.Effect<void, ReturnType<typeof createSentinelError>>;
  }
>()("Database") {
  static readonly layer = Layer.effect(this)(
    Effect.gen(function* () {
      const { databaseUrl } = yield* DatabaseConfig;
      const handle = yield* Effect.acquireRelease(
        Effect.sync(() => createDatabaseHandle(databaseUrl)),
        ({ client }) => Effect.promise(() => client.end()).pipe(Effect.orDie),
      );

      return Database.of({
        ...handle,
        ping: () =>
          Effect.tryPromise({
            try: async () => {
              await handle.client`select 1`;
            },
            catch: (cause) =>
              createSentinelError({
                module: "@ns-sentinel/db",
                operation: "Database.ping",
                message: "Failed to execute the database health check.",
                cause,
              }),
          }),
      });
    }),
  );
}

export const layer = Database.layer.pipe(Layer.provide(DatabaseConfig.layer));

export const runtime = makeNodeRuntime(layer);
