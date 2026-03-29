import { Box } from "@upstash/box";
import { Data, Effect } from "effect";
import { env } from "$env/dynamic/private";
import { error } from "@sveltejs/kit";
import { z } from "zod/v3";
import {
  Database,
  and,
  desc,
  eq,
  layer as databaseLayer,
  schema,
} from "@ns-sentinel/db";
import {
  getGeneratedChannelsCatalogData,
  getLatestGeneratedChannelOverviewData,
} from "$lib/server/generated-runtime-data";

class GeneratedAppsError extends Data.TaggedError("GeneratedAppsError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

type GeneratedAppRecord = typeof schema.generatedApps.$inferSelect;
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

const GeneratedArtifactSchema = z.object({
  endpoint: z.object({
    code: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9-]+$/u),
  }),
  page: z.object({
    css: z.string(),
    html: z.string().min(1),
    js: z.string().min(1),
  }),
  title: z.string().min(1).max(120),
});

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

const summarizeForPrompt = <T>(value: T) =>
  JSON.stringify(value, null, 2).slice(0, 6_000);

const getAsyncFunction = () =>
  Object.getPrototypeOf(async function placeholder() {}).constructor as new (
    ...args: string[]
  ) => (ctx: {
    fetchJson: (path: string) => Promise<unknown>;
    params: Record<string, string>;
    searchParams: URLSearchParams;
  }) => Promise<unknown>;

const getGenerationConfig = () => {
  const upstashBoxApiKey = env.UPSTASH_BOX_API_KEY;
  const openAiApiKey = env.OPENAI_API_KEY;

  if (!upstashBoxApiKey) {
    throw new GeneratedAppsError({
      message:
        "Missing UPSTASH_BOX_API_KEY. Add it to the workspace .env file before generating pages.",
    });
  }

  if (!openAiApiKey) {
    throw new GeneratedAppsError({
      message:
        "Missing OPENAI_API_KEY. Add it to the workspace .env file before generating pages.",
    });
  }

  return {
    openAiApiKey,
    upstashBoxApiKey,
  };
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

const getAppForSlug = async (database: DatabaseService, slug: string) =>
  database.db.query.generatedApps.findFirst({
    where: (generatedApps, { eq }) => eq(generatedApps.slug, slug),
  });

const getVersionById = async (database: DatabaseService, runId: string) =>
  database.db.query.generatedAppVersions.findFirst({
    where: (generatedAppVersions, { eq }) => eq(generatedAppVersions.id, runId),
  });

const getLatestVersionForApp = async (
  database: DatabaseService,
  appId: string,
) =>
  (await database.db.query.generatedAppVersions.findFirst({
    orderBy: (generatedAppVersions, { desc }) => [
      desc(generatedAppVersions.versionNumber),
    ],
    where: (generatedAppVersions, { eq }) =>
      eq(generatedAppVersions.appId, appId),
  })) ?? null;

const getLatestReadyVersionForApp = async (
  database: DatabaseService,
  appId: string,
  input?: {
    readonly excludeVersionId?: string;
  },
) => {
  const readyVersions = await database.db
    .select()
    .from(schema.generatedAppVersions)
    .where(
      and(
        eq(schema.generatedAppVersions.appId, appId),
        eq(schema.generatedAppVersions.status, "ready"),
      ),
    )
    .orderBy(desc(schema.generatedAppVersions.versionNumber))
    .limit(input?.excludeVersionId ? 2 : 1);

  return (
    readyVersions.find((version) => version.id !== input?.excludeVersionId) ??
    null
  );
};

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

const updateApp = async (
  database: DatabaseService,
  input: {
    readonly appId: string;
    readonly boxId?: string;
    readonly title?: string;
  },
) => {
  await database.db
    .update(schema.generatedApps)
    .set({
      boxId: input.boxId,
      title: input.title,
      updatedAt: new Date(),
    })
    .where(eq(schema.generatedApps.id, input.appId));
};

const saveArtifacts = async (
  database: DatabaseService,
  input: {
    readonly appVersionId: string;
    readonly endpoint: {
      readonly code: string;
      readonly slug: string;
    };
    readonly page: GeneratedPageBundle;
  },
) => {
  await database.db
    .delete(schema.generatedArtifacts)
    .where(eq(schema.generatedArtifacts.appVersionId, input.appVersionId));

  await database.db.insert(schema.generatedArtifacts).values([
    {
      appVersionId: input.appVersionId,
      content: JSON.stringify(input.page),
      kind: "page",
      metadata: {
        endpointSlug: input.page.endpointSlug,
        title: input.page.title,
      },
      slug: "page",
    },
    {
      appVersionId: input.appVersionId,
      content: input.endpoint.code,
      kind: "endpoint",
      metadata: {
        title: input.page.title,
      },
      slug: input.endpoint.slug,
    },
  ]);
};

const getPageArtifactForVersion = async (
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

const getEndpointArtifactForVersion = async (
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

const getSeedArtifactsForApp = async (
  database: DatabaseService,
  appId: string,
  input?: {
    readonly excludeVersionId?: string;
  },
) => {
  const latestReadyVersion = await getLatestReadyVersionForApp(
    database,
    appId,
    {
      excludeVersionId: input?.excludeVersionId,
    },
  );

  if (!latestReadyVersion) {
    return null;
  }

  const pageArtifact = await getPageArtifactForVersion(
    database,
    latestReadyVersion.id,
  );

  if (!pageArtifact) {
    return null;
  }

  const page = JSON.parse(pageArtifact.content) as GeneratedPageBundle;
  const endpointArtifact = await getEndpointArtifactForVersion(database, {
    appVersionId: latestReadyVersion.id,
    endpointSlug: page.endpointSlug,
  });

  if (!endpointArtifact) {
    return null;
  }

  return {
    endpoint: {
      code: endpointArtifact.content,
      slug: page.endpointSlug,
    },
    page,
    version: latestReadyVersion,
  };
};

const syncArtifactsToBox = async (input: {
  readonly box: Box;
  readonly endpoint: {
    readonly code: string;
    readonly slug: string;
  };
  readonly page: GeneratedPageBundle;
  readonly prompt: string;
  readonly revision: number;
}) => {
  await input.box.files.write({
    content: input.page.html,
    path: "generated-app/page.html",
  });
  await input.box.files.write({
    content: input.page.css,
    path: "generated-app/page.css",
  });
  await input.box.files.write({
    content: input.page.js,
    path: "generated-app/page.js",
  });
  await input.box.files.write({
    content: input.endpoint.code,
    path: "generated-app/endpoint.js",
  });
  await input.box.files.write({
    content: JSON.stringify(
      {
        endpointSlug: input.endpoint.slug,
        prompt: input.prompt,
        revision: input.revision,
        title: input.page.title,
      },
      null,
      2,
    ),
    path: "generated-app/current.json",
  });
};

const buildPrompt = async (input: {
  readonly appSlug: string;
  readonly hasExistingImplementation: boolean;
  readonly prompt: string;
}) => {
  const [catalog, latestOverview] = await Promise.all([
    getGeneratedChannelsCatalogData(),
    getLatestGeneratedChannelOverviewData(),
  ]);

  const catalogSample = catalog.slice(0, 4);
  const latestOverviewSample = latestOverview.channel
    ? {
        ...latestOverview,
        posts: latestOverview.posts.slice(0, 2),
        videos: latestOverview.videos.slice(0, 2),
      }
    : latestOverview;

  const continuityInstructions = input.hasExistingImplementation
    ? `
This app already has an implementation in the current durable Box workspace.

Continue from the existing files in /workspace/home/generated-app:
- page.html
- page.css
- page.js
- endpoint.js
- current.json

Treat the user's request as an edit to the current implementation. Preserve and improve the existing direction instead of starting from scratch unless the request clearly asks for a major reset.
`.trim()
    : `
This is the first implementation for this app. After you generate the result, the system will save it into /workspace/home/generated-app for future edits.
`.trim();

  return `
You are generating a production-ready, read-only custom page for a SvelteKit dashboard.

User request:
${input.prompt}

App slug:
${input.appSlug}

${continuityInstructions}

Return JSON only. No markdown fences. No explanations.

The JSON must match this shape:
{
  "title": "short page title",
  "page": {
    "html": "HTML markup only for inside <body>",
    "css": "plain CSS string",
    "js": "plain browser JS string"
  },
  "endpoint": {
    "slug": "short-endpoint-slug",
    "code": "async function body only"
  }
}

Rules for the generated page:
- Build a strong, intentional data UI that fits the warm neutral Sentinel dashboard aesthetic.
- Do not output <html>, <head>, <body>, <script>, or <style> tags inside page.html.
- page.js must use vanilla JS only.
- page.js must fetch data from window.__GENERATED_APP__.endpointUrl.
- page.js should render into the markup defined in page.html.
- No external scripts, fonts, or network calls beyond window.__GENERATED_APP__.endpointUrl.
- Keep the page fully read-only.

Rules for the generated endpoint:
- endpoint.code is the body of an async function that receives ctx.
- Available ctx fields:
  - ctx.fetchJson(path): fetches approved internal JSON endpoints
  - ctx.params
  - ctx.searchParams
- Return a JSON-serializable object only.
- Do not use eval, Function, dynamic import, or external network calls.

Approved internal read-only endpoints:
- /internal/read/channels
- /internal/read/channels/latest/overview

Sample response for /internal/read/channels:
${summarizeForPrompt(catalogSample)}

Sample response for /internal/read/channels/latest/overview:
${summarizeForPrompt(latestOverviewSample)}

Make the endpoint shape exactly what the page needs.
`.trim();
};

const createBoxForApp = async (input: {
  readonly app: GeneratedAppRecord;
  readonly database: DatabaseService;
  readonly openAiApiKey: string;
  readonly upstashBoxApiKey: string;
}) => {
  const box = await Box.create({
    agent: {
      apiKey: input.openAiApiKey,
      model: "openai/gpt-5.4-mini",
      provider: "codex",
    },
    apiKey: input.upstashBoxApiKey,
    name: `generated-${input.app.slug}`,
    runtime: "node",
  });

  await updateApp(input.database, {
    appId: input.app.id,
    boxId: box.id,
  });

  return box;
};

const getOrCreatePersistentBox = async (input: {
  readonly app: GeneratedAppRecord;
  readonly database: DatabaseService;
  readonly openAiApiKey: string;
  readonly upstashBoxApiKey: string;
}) => {
  if (!input.app.boxId) {
    return {
      box: await createBoxForApp(input),
      mode: "created" as const,
    };
  }

  try {
    const box = await Box.get(input.app.boxId, {
      apiKey: input.upstashBoxApiKey,
    });
    const status = await box.getStatus();

    if (status.status === "paused") {
      await box.resume();
    }

    return {
      box,
      mode: "reused" as const,
    };
  } catch {
    return {
      box: await createBoxForApp(input),
      mode: "recreated" as const,
    };
  }
};

const persistGeneratedVersion = async (input: {
  readonly box: Box;
  readonly endpoint: {
    readonly code: string;
    readonly slug: string;
  };
  readonly page: {
    readonly css: string;
    readonly html: string;
    readonly js: string;
  };
  readonly title: string;
  readonly version: GeneratedAppVersionRecord;
}) =>
  runGeneratedAppsEffect(
    Effect.gen(function* () {
      const database = yield* Database;

      yield* Effect.tryPromise({
        try: async () => {
          await saveArtifacts(database, {
            appVersionId: input.version.id,
            endpoint: input.endpoint,
            page: {
              css: input.page.css,
              endpointSlug: input.endpoint.slug,
              html: input.page.html,
              js: input.page.js,
              title: input.title,
            },
          });

          await syncArtifactsToBox({
            box: input.box,
            endpoint: input.endpoint,
            page: {
              css: input.page.css,
              endpointSlug: input.endpoint.slug,
              html: input.page.html,
              js: input.page.js,
              title: input.title,
            },
            prompt: input.version.prompt,
            revision: input.version.versionNumber,
          });

          await updateVersion(database, {
            appVersionId: input.version.id,
            errorMessage: null,
            status: "ready",
            title: input.title,
          });

          await updateApp(database, {
            appId: input.version.appId,
            title: input.title,
          });

          await appendEvent(database, {
            appVersionId: input.version.id,
            eventType: "ready",
            message: "Preview is ready",
          });
        },
        catch: (cause) =>
          new GeneratedAppsError({
            message: `Failed to persist generated artifacts for version "${input.version.id}".`,
            cause,
          }),
      });
    }),
  );

const failGeneratedVersion = async (input: {
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
            message: `Failed to mark generated version "${input.versionId}" as failed.`,
            cause,
          }),
      });
    }),
  );

const runGenerationForVersion = async (versionId: string) => {
  let box: Box | null = null;

  try {
    const { openAiApiKey, upstashBoxApiKey } = getGenerationConfig();

    const version = await runGeneratedAppsEffect(
      Effect.gen(function* () {
        const database = yield* Database;
        const versionRecord = yield* Effect.tryPromise({
          try: async () => {
            const value = await getVersionById(database, versionId);

            if (!value) {
              throw new GeneratedAppsError({
                message: `Generated version "${versionId}" was not found.`,
              });
            }

            await updateVersion(database, {
              appVersionId: versionId,
              status: "generating",
            });

            await appendEvent(database, {
              appVersionId: versionId,
              eventType: "generating",
              message: "Starting Box generation",
            });

            return value;
          },
          catch: (cause) =>
            cause instanceof GeneratedAppsError
              ? cause
              : new GeneratedAppsError({
                  message: `Failed to prepare generated version "${versionId}".`,
                  cause,
                }),
        });

        return versionRecord;
      }),
    );

    const app = await runGeneratedAppsEffect(
      Effect.gen(function* () {
        const database = yield* Database;
        const appRecord = yield* Effect.tryPromise({
          try: async () => {
            const value = await database.db.query.generatedApps.findFirst({
              where: (generatedApps, { eq }) =>
                eq(generatedApps.id, version.appId),
            });

            if (!value) {
              throw new GeneratedAppsError({
                message: `Generated app "${version.appId}" was not found.`,
              });
            }

            return value;
          },
          catch: (cause) =>
            cause instanceof GeneratedAppsError
              ? cause
              : new GeneratedAppsError({
                  message: `Failed to load generated app "${version.appId}".`,
                  cause,
                }),
        });

        return appRecord;
      }),
    );

    const database = await resolveDatabase();
    const previousArtifacts = await getSeedArtifactsForApp(database, app.id, {
      excludeVersionId: version.id,
    });
    const persistentBox = await getOrCreatePersistentBox({
      app,
      database,
      openAiApiKey,
      upstashBoxApiKey,
    });
    box = persistentBox.box;

    await appendEvent(database, {
      appVersionId: version.id,
      eventType:
        persistentBox.mode === "reused"
          ? "box-reused"
          : persistentBox.mode === "recreated"
            ? "box-recreated"
            : "box-created",
      message:
        persistentBox.mode === "reused"
          ? "Reusing the existing sandbox"
          : persistentBox.mode === "recreated"
            ? "Recreated the sandbox and restored the latest revision"
            : "Created a sandbox for this generated app",
      metadata: {
        boxId: box.id,
      },
    });

    if (persistentBox.mode !== "reused" && previousArtifacts) {
      await syncArtifactsToBox({
        box,
        endpoint: previousArtifacts.endpoint,
        page: previousArtifacts.page,
        prompt: previousArtifacts.version.prompt,
        revision: previousArtifacts.version.versionNumber,
      });

      await appendEvent(database, {
        appVersionId: version.id,
        eventType: "box-seeded",
        message: "Seeded the sandbox with the latest ready revision",
      });
    }

    const prompt = await buildPrompt({
      appSlug: app.slug,
      hasExistingImplementation: previousArtifacts !== null,
      prompt: version.prompt,
    });

    await appendEvent(database, {
      appVersionId: version.id,
      eventType: "box-ready",
      message: "Sandbox is ready and generating artifacts",
      metadata: {
        boxId: box.id,
      },
    });

    const run = await box.agent.run({
      maxRetries: 1,
      onToolUse: (tool) => {
        void runGeneratedAppsEffect(
          Effect.gen(function* () {
            const activeDatabase = yield* Database;

            yield* Effect.tryPromise({
              try: () =>
                appendEvent(activeDatabase, {
                  appVersionId: version.id,
                  eventType: `tool:${tool.name}`,
                  message: `Box used ${tool.name}`,
                  metadata: {
                    input: tool.input,
                  },
                }),
              catch: (cause) =>
                new GeneratedAppsError({
                  message: `Failed to record tool usage for version "${version.id}".`,
                  cause,
                }),
            });
          }),
        );
      },
      prompt,
      responseSchema: GeneratedArtifactSchema,
      timeout: 240_000,
    });

    if (run.status !== "completed") {
      throw new GeneratedAppsError({
        message: `Box generation did not complete successfully. Final status: ${run.status}.`,
      });
    }

    await persistGeneratedVersion({
      box,
      endpoint: run.result.endpoint,
      page: run.result.page,
      title: run.result.title,
      version,
    });
  } catch (cause) {
    const message =
      cause instanceof GeneratedAppsError
        ? cause.message
        : cause instanceof Error
          ? cause.message
          : "Generated page creation failed.";

    await failGeneratedVersion({
      message,
      versionId,
    });
  } finally {
    if (box) {
      await box.pause().catch(() => undefined);
    }
  }
};

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

      void runGenerationForVersion(snapshot.runId);

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

      void runGenerationForVersion(snapshot.runId);

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

            const response =
              path === "/internal/read/channels"
                ? await getGeneratedChannelsCatalogData()
                : await getLatestGeneratedChannelOverviewData();

            return response;
          };

          const value = await execute({
            fetchJson,
            params: {},
            searchParams: input.searchParams,
          });

          return value;
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
