import { env } from "$env/dynamic/private";
import { configure, tasks } from "@trigger.dev/sdk";
import {
  createConvexPublicServerClient,
  createConvexServerClient,
} from "@ns-sentinel/convex";
import { api } from "@ns-sentinel/convex/api";
import type { Id } from "@ns-sentinel/convex/data-model";

const generatedPageTaskId = "generated-page.generate-version";

const getConvexClient = () => {
  const convexUrl = env.CONVEX_URL?.trim();

  if (!convexUrl) {
    throw new Error("Missing CONVEX_URL.");
  }

  return createConvexServerClient(convexUrl);
};

const configureTriggerClient = () => {
  const secretKey = env.TRIGGER_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new Error("Missing TRIGGER_SECRET_KEY.");
  }

  const baseURL = env.TRIGGER_API_URL?.trim();

  configure({
    secretKey,
    ...(baseURL ? { baseURL } : {}),
  });
};

const enqueueGeneration = async (input: {
  readonly versionId: Id<"pageVersions">;
}) => {
  configureTriggerClient();

  return tasks.trigger(generatedPageTaskId, {
    versionId: input.versionId,
  });
};

const markVersionError = async (input: {
  readonly message: string;
  readonly versionId: Id<"pageVersions">;
}) => {
  const convex = getConvexClient();

  await convex.mutation(api.pages.markVersionError, {
    errorMessage: input.message,
    versionId: input.versionId,
  });
};

export const createGeneratedPage = async (prompt: string) => {
  const convex = getConvexClient();
  const created = await convex.mutation(api.pages.createPage, {
    prompt,
  });

  try {
    const run = await enqueueGeneration({
      versionId: created.versionId,
    });

    await convex.mutation(api.pages.attachTriggerRun, {
      triggerRunId: run.id,
      versionId: created.versionId,
    });

    return {
      slug: created.slug,
      versionId: created.versionId,
    };
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : "Failed to start the generated page workflow.";

    await markVersionError({
      message,
      versionId: created.versionId,
    });

    throw cause;
  }
};

export const createGeneratedPageEdit = async (input: {
  readonly baseVersionId: Id<"pageVersions">;
  readonly prompt: string;
  readonly slug: string;
}) => {
  const convex = getConvexClient();
  const publicConvex = createConvexPublicServerClient(env.CONVEX_URL!.trim());
  const pageView = await publicConvex.query(api.pages.getPageView, {
    slug: input.slug,
    versionId: input.baseVersionId,
  });

  if (!pageView) {
    throw new Error("Generated page not found.");
  }

  const created = await convex.mutation(api.pages.createEditVersion, {
    baseVersionId: input.baseVersionId,
    pageId: pageView.page.id,
    prompt: input.prompt,
  });

  try {
    const run = await enqueueGeneration({
      versionId: created.versionId,
    });

    await convex.mutation(api.pages.attachTriggerRun, {
      triggerRunId: run.id,
      versionId: created.versionId,
    });

    return {
      slug: created.slug,
      versionId: created.versionId,
    };
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : "Failed to start the generated page workflow.";

    await markVersionError({
      message,
      versionId: created.versionId,
    });

    throw cause;
  }
};

export const deleteGeneratedPage = async (pageId: Id<"pages">) => {
  const convex = getConvexClient();

  await convex.mutation(api.pages.deletePage, {
    pageId,
  });
};

export const retryGeneratedPageVersion = async (
  versionId: Id<"pageVersions">,
) => {
  const convex = getConvexClient();

  await convex.mutation(api.pages.retryVersion, {
    versionId,
  });

  try {
    const run = await enqueueGeneration({
      versionId,
    });

    await convex.mutation(api.pages.attachTriggerRun, {
      triggerRunId: run.id,
      versionId,
    });

    return {
      versionId,
    };
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : "Failed to retry the generated page workflow.";

    await markVersionError({
      message,
      versionId,
    });

    throw cause;
  }
};
