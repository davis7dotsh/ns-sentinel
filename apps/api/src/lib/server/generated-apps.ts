import { configure, tasks } from "@trigger.dev/sdk";
import { Data, Effect } from "effect";
import { env } from "$env/dynamic/private";
import { error } from "@sveltejs/kit";
import type { generateGeneratedPageVersionTask } from "@ns-sentinel/trigger";
import {
  getGeneratedChannelsCatalogData,
  getLatestGeneratedChannelOverviewData,
} from "@ns-sentinel/trigger";
import {
  Database,
  and,
  desc,
  eq,
  layer as databaseLayer,
  schema,
} from "@ns-sentinel/db";

class GeneratedAppsError extends Data.TaggedError("GeneratedAppsError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

type GeneratedAppVersionRecord =
  typeof schema.generatedAppVersions.$inferSelect;

type GeneratedAppSnapshot = {
  readonly eventType: string;
  readonly iframeUrl: string;
  readonly prompt: string;
  readonly revision: number;
  readonly runId: string;
  readonly slug: string;
  readonly status: "queued" | "generating" | "ready" | "failed";
  readonly statusLabel: string;
  readonly title: string;
};

type GeneratedPageBundle = {
  readonly css: string;
  readonly endpointSlug: string;
  readonly html: string;
  readonly js: string;
  readonly title: string;
};

const generatedPageTaskId = "generated-page.generate-version";

const runGeneratedAppsEffect = async <A>(
  effect: Effect.Effect<A, GeneratedAppsError, Database>,
) =>
  Effect.runPromise(effect.pipe(Effect.provide(databaseLayer))).catch(
    (cause) => {
      if (
        typeof cause === "object" &&
        cause !== null &&
        "status" in cause &&
        typeof cause.status === "number"
      ) {
        throw cause;
      }

      console.error(cause);
      throw error(500, "Failed to process generated app data.");
    },
  );

const resolveDatabase = () =>
  runGeneratedAppsEffect(
    Effect.gen(function* () {
      return yield* Database;
    }),
  );

type DatabaseService = Awaited<ReturnType<typeof resolveDatabase>>;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);

const getInitialTitle = (prompt: string) => {
  const trimmed = prompt.trim();

  return trimmed.length === 0 ? "Generated Page" : trimmed.slice(0, 96);
};

const getAsyncFunction = () =>
  Object.getPrototypeOf(async function placeholder() {}).constructor as new (
    ...args: string[]
  ) => (ctx: {
    fetchJson: (path: string) => Promise<unknown>;
    params: Record<string, string>;
    searchParams: URLSearchParams;
  }) => Promise<unknown>;

const configureTriggerClient = () => {
  const secretKey = env.TRIGGER_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new GeneratedAppsError({
      message:
        "Missing TRIGGER_SECRET_KEY. Add your Trigger.dev secret key to the API environment before generating pages.",
    });
  }

  const baseURL = env.TRIGGER_API_URL?.trim();

  configure({
    secretKey,
    ...(baseURL ? { baseURL } : {}),
  });
};

const enqueueGeneratedVersion = async (versionId: string) => {
  configureTriggerClient();

  return tasks.trigger<typeof generateGeneratedPageVersionTask>(
    generatedPageTaskId,
    {
      versionId,
    },
  );
};

const getLatestEvent = async (
  database: DatabaseService,
  appVersionId: string,
) => {
  const [latestEvent] = await database.db
    .select()
    .from(schema.generatedEvents)
    .where(eq(schema.generatedEvents.appVersionId, appVersionId))
    .orderBy(desc(schema.generatedEvents.createdAt))
    .limit(1);

  return latestEvent ?? null;
};

const getAppForSlug = (database: DatabaseService, slug: string) =>
  database.db.query.generatedApps.findFirst({
    where: (generatedApps, { eq }) => eq(generatedApps.slug, slug),
  });

const getVersionById = (database: DatabaseService, runId: string) =>
  database.db.query.generatedAppVersions.findFirst({
    where: (generatedAppVersions, { eq }) => eq(generatedAppVersions.id, runId),
  });

const getLatestVersionForApp = (database: DatabaseService, appId: string) =>
  database.db.query.generatedAppVersions.findFirst({
    orderBy: (generatedAppVersions, { desc }) => [
      desc(generatedAppVersions.versionNumber),
    ],
    where: (generatedAppVersions, { eq }) =>
      eq(generatedAppVersions.appId, appId),
  });

const getLatestReadyVersionForApp = async (
  database: DatabaseService,
  appId: string,
) =>
  (await database.db.query.generatedAppVersions.findFirst({
    orderBy: (generatedAppVersions, { desc }) => [
      desc(generatedAppVersions.versionNumber),
    ],
    where: (generatedAppVersions, { and, eq }) =>
      and(
        eq(generatedAppVersions.appId, appId),
        eq(generatedAppVersions.status, "ready"),
      ),
  })) ?? null;

const getLatestVersionForSlug = async (
  database: DatabaseService,
  slug: string,
) => {
  const app = await getAppForSlug(database, slug);

  if (!app) {
    return null;
  }

  return getLatestVersionForApp(database, app.id);
};

const getLatestReadyVersionForSlug = async (
  database: DatabaseService,
  slug: string,
) => {
  const app = await getAppForSlug(database, slug);

  if (!app) {
    return null;
  }

  return getLatestReadyVersionForApp(database, app.id);
};

const buildSnapshot = async (
  database: DatabaseService,
  version: GeneratedAppVersionRecord,
) => {
  const app = await database.db.query.generatedApps.findFirst({
    where: (generatedApps, { eq }) => eq(generatedApps.id, version.appId),
  });

  if (!app) {
    return null;
  }

  const latestEvent = await getLatestEvent(database, version.id);

  return {
    eventType: latestEvent?.eventType ?? version.status,
    iframeUrl: `/sandbox/${app.slug}?run=${version.id}`,
    prompt: version.prompt,
    revision: version.versionNumber,
    runId: version.id,
    slug: app.slug,
    status: version.status as GeneratedAppSnapshot["status"],
    statusLabel: latestEvent?.message ?? version.status,
    title: version.title || app.title,
  } satisfies GeneratedAppSnapshot;
};

const createUniqueSlug = async (database: DatabaseService, prompt: string) => {
  const baseSlug = slugify(prompt) || "generated-page";
  let suffix = 0;

  while (true) {
    const candidate = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`;
    const existing = await getAppForSlug(database, candidate);

    if (!existing) {
      return candidate;
    }

    suffix += 1;
  }
};

const appendEvent = async (
  database: DatabaseService,
  input: {
    readonly appVersionId: string;
    readonly eventType: string;
    readonly message: string;
    readonly metadata?: Record<string, unknown>;
  },
) => {
  await database.db.insert(schema.generatedEvents).values({
    appVersionId: input.appVersionId,
    eventType: input.eventType,
    message: input.message,
    metadata: input.metadata ?? null,
  });
};

const updateVersion = async (
  database: DatabaseService,
  input: {
    readonly appVersionId: string;
    readonly errorMessage?: string | null;
    readonly status?: string;
    readonly title?: string;
  },
) => {
  await database.db
    .update(schema.generatedAppVersions)
    .set({
      errorMessage:
        input.errorMessage === undefined ? undefined : input.errorMessage,
      status: input.status,
      title: input.title,
      updatedAt: new Date(),
    })
    .where(eq(schema.generatedAppVersions.id, input.appVersionId));
};

const getPageArtifactForVersion = (
  database: DatabaseService,
  appVersionId: string,
) =>
  database.db.query.generatedArtifacts.findFirst({
    where: (generatedArtifacts, { and, eq }) =>
      and(
        eq(generatedArtifacts.appVersionId, appVersionId),
        eq(generatedArtifacts.kind, "page"),
      ),
  });

const getEndpointArtifactForVersion = (
  database: DatabaseService,
  input: {
    readonly appVersionId: string;
    readonly endpointSlug: string;
  },
) =>
  database.db.query.generatedArtifacts.findFirst({
    where: (generatedArtifacts, { and, eq }) =>
      and(
        eq(generatedArtifacts.appVersionId, input.appVersionId),
        eq(generatedArtifacts.kind, "endpoint"),
        eq(generatedArtifacts.slug, input.endpointSlug),
      ),
  });

const markEnqueueFailure = async (input: {
  readonly message: string;
  readonly versionId: string;
}) =>
  runGeneratedAppsEffect(
    Effect.gen(function* () {
      const database = yield* Database;

      yield* Effect.tryPromise({
        try: async () => {
          await updateVersion(database, {
            appVersionId: input.versionId,
            errorMessage: input.message,
            status: "failed",
          });

          await appendEvent(database, {
            appVersionId: input.versionId,
            eventType: "failed",
            message: input.message,
          });
        },
        catch: (cause) =>
          new GeneratedAppsError({
            message: `Failed to mark version "${input.versionId}" as failed after Trigger enqueue failed.`,
            cause,
          }),
      });
    }),
  );

export const createGeneratedAppRun = (prompt: string) =>
  runGeneratedAppsEffect(
    Effect.gen(function* () {
      const database = yield* Database;
      const trimmedPrompt = prompt.trim();

      if (trimmedPrompt.length === 0) {
        throw error(400, "A prompt is required.");
      }

      const snapshot = yield* Effect.tryPromise({
        try: async () => {
          const slug = await createUniqueSlug(database, trimmedPrompt);
          const initialTitle = getInitialTitle(trimmedPrompt);

          const [app] = await database.db
            .insert(schema.generatedApps)
            .values({
              slug,
              title: initialTitle,
            })
            .returning();

          const [version] = await database.db
            .insert(schema.generatedAppVersions)
            .values({
              appId: app.id,
              prompt: trimmedPrompt,
              status: "queued",
              title: initialTitle,
              versionNumber: 1,
            })
            .returning();

          await appendEvent(database, {
            appVersionId: version.id,
            eventType: "queued",
            message: "Queued for generation",
          });

          const value = await buildSnapshot(database, version);

          if (!value) {
            throw new GeneratedAppsError({
              message: `Failed to build a snapshot for generated version "${version.id}".`,
            });
          }

          return value;
        },
        catch: (cause) =>
          cause instanceof GeneratedAppsError
            ? cause
            : new GeneratedAppsError({
                message: "Failed to create a generated app run.",
                cause,
              }),
      });

      yield* Effect.tryPromise({
        try: async () => {
          try {
            await enqueueGeneratedVersion(snapshot.runId);
          } catch (cause) {
            const message =
              cause instanceof Error
                ? cause.message
                : `Failed to enqueue generated version "${snapshot.runId}" in Trigger.dev.`;

            await markEnqueueFailure({
              message,
              versionId: snapshot.runId,
            });

            throw new GeneratedAppsError({
              message,
              cause,
            });
          }
        },
        catch: (cause) =>
          cause instanceof GeneratedAppsError
            ? cause
            : new GeneratedAppsError({
                message: `Failed to enqueue generated version "${snapshot.runId}".`,
                cause,
              }),
      });

      return snapshot;
    }),
  );

export const createGeneratedAppEditRun = (input: {
  readonly prompt: string;
  readonly slug: string;
}) =>
  runGeneratedAppsEffect(
    Effect.gen(function* () {
      const database = yield* Database;
      const trimmedPrompt = input.prompt.trim();

      if (trimmedPrompt.length === 0) {
        throw error(400, "An edit prompt is required.");
      }

      const snapshot = yield* Effect.tryPromise({
        try: async () => {
          const app = await getAppForSlug(database, input.slug);

          if (!app) {
            throw error(404, "Generated app not found.");
          }

          const latestVersion = await getLatestVersionForApp(database, app.id);
          const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;
          const initialTitle = getInitialTitle(trimmedPrompt);

          const [version] = await database.db
            .insert(schema.generatedAppVersions)
            .values({
              appId: app.id,
              prompt: trimmedPrompt,
              status: "queued",
              title: initialTitle,
              versionNumber: nextVersionNumber,
            })
            .returning();

          await appendEvent(database, {
            appVersionId: version.id,
            eventType: "queued",
            message: "Queued your edit for regeneration",
          });

          const value = await buildSnapshot(database, version);

          if (!value) {
            throw new GeneratedAppsError({
              message: `Failed to build a snapshot for generated version "${version.id}".`,
            });
          }

          return value;
        },
        catch: (cause) =>
          cause instanceof GeneratedAppsError
            ? cause
            : new GeneratedAppsError({
                message: `Failed to create an edit run for slug "${input.slug}".`,
                cause,
              }),
      });

      yield* Effect.tryPromise({
        try: async () => {
          try {
            await enqueueGeneratedVersion(snapshot.runId);
          } catch (cause) {
            const message =
              cause instanceof Error
                ? cause.message
                : `Failed to enqueue generated version "${snapshot.runId}" in Trigger.dev.`;

            await markEnqueueFailure({
              message,
              versionId: snapshot.runId,
            });

            throw new GeneratedAppsError({
              message,
              cause,
            });
          }
        },
        catch: (cause) =>
          cause instanceof GeneratedAppsError
            ? cause
            : new GeneratedAppsError({
                message: `Failed to enqueue generated version "${snapshot.runId}".`,
                cause,
              }),
      });

      return snapshot;
    }),
  );

export const getGeneratedAppSnapshot = (input: {
  readonly runId?: string | null;
  readonly slug: string;
}) =>
  runGeneratedAppsEffect(
    Effect.gen(function* () {
      const database = yield* Database;

      const snapshot = yield* Effect.tryPromise({
        try: async () => {
          const version = input.runId
            ? await getVersionById(database, input.runId)
            : await getLatestVersionForSlug(database, input.slug);

          if (!version) {
            return null;
          }

          const value = await buildSnapshot(database, version);

          if (!value || value.slug !== input.slug) {
            return null;
          }

          return value;
        },
        catch: (cause) =>
          new GeneratedAppsError({
            message: `Failed to load generated app snapshot for slug "${input.slug}".`,
            cause,
          }),
      });

      return snapshot;
    }),
  );

export const getGeneratedPageBundle = (input: {
  readonly runId?: string | null;
  readonly slug: string;
}) =>
  runGeneratedAppsEffect(
    Effect.gen(function* () {
      const database = yield* Database;

      const bundle = yield* Effect.tryPromise({
        try: async () => {
          const version = input.runId
            ? await getVersionById(database, input.runId)
            : await getLatestReadyVersionForSlug(database, input.slug);

          if (!version || version.status !== "ready") {
            return null;
          }

          const app = await database.db.query.generatedApps.findFirst({
            where: (generatedApps, { eq }) =>
              eq(generatedApps.id, version.appId),
          });

          if (!app || app.slug !== input.slug) {
            return null;
          }

          const artifact = await getPageArtifactForVersion(
            database,
            version.id,
          );

          if (!artifact) {
            return null;
          }

          return {
            app,
            page: JSON.parse(artifact.content) as GeneratedPageBundle,
            version,
          };
        },
        catch: (cause) =>
          new GeneratedAppsError({
            message: `Failed to load the generated page bundle for slug "${input.slug}".`,
            cause,
          }),
      });

      return bundle;
    }),
  );

export const runGeneratedEndpoint = (input: {
  readonly endpointSlug: string;
  readonly runId?: string | null;
  readonly searchParams: URLSearchParams;
  readonly slug: string;
}) =>
  runGeneratedAppsEffect(
    Effect.gen(function* () {
      const database = yield* Database;

      const result = yield* Effect.tryPromise({
        try: async () => {
          const version = input.runId
            ? await getVersionById(database, input.runId)
            : await getLatestReadyVersionForSlug(database, input.slug);

          if (!version || version.status !== "ready") {
            return null;
          }

          const app = await database.db.query.generatedApps.findFirst({
            where: (generatedApps, { eq }) =>
              eq(generatedApps.id, version.appId),
          });

          if (!app || app.slug !== input.slug) {
            return null;
          }

          const artifact = await getEndpointArtifactForVersion(database, {
            appVersionId: version.id,
            endpointSlug: input.endpointSlug,
          });

          if (!artifact) {
            return null;
          }

          const allowedPaths = new Set([
            "/internal/read/channels",
            "/internal/read/channels/latest/overview",
          ]);

          const AsyncFunction = getAsyncFunction();
          const execute = new AsyncFunction("ctx", artifact.content);
          const fetchJson = async (path: string) => {
            if (!allowedPaths.has(path)) {
              throw new Error(
                `The generated endpoint cannot access "${path}".`,
              );
            }

            return path === "/internal/read/channels"
              ? getGeneratedChannelsCatalogData()
              : getLatestGeneratedChannelOverviewData();
          };

          return execute({
            fetchJson,
            params: {},
            searchParams: input.searchParams,
          });
        },
        catch: (cause) =>
          new GeneratedAppsError({
            message: `Failed to execute generated endpoint "${input.endpointSlug}" for slug "${input.slug}".`,
            cause,
          }),
      });

      return result;
    }),
  );

export const getGeneratedAppSnapshotByRunId = (runId: string) =>
  runGeneratedAppsEffect(
    Effect.gen(function* () {
      const database = yield* Database;

      const snapshot = yield* Effect.tryPromise({
        try: async () => {
          const version = await getVersionById(database, runId);

          if (!version) {
            return null;
          }

          return buildSnapshot(database, version);
        },
        catch: (cause) =>
          new GeneratedAppsError({
            message: `Failed to load generated snapshot for run "${runId}".`,
            cause,
          }),
      });

      return snapshot;
    }),
  );
