import { env } from "$env/dynamic/private";
import { createConvexServerClient } from "@ns-sentinel/convex";
import { api } from "@ns-sentinel/convex/api";
import type { Id } from "@ns-sentinel/convex/data-model";
import { callRuntimeFunction } from "@ns-sentinel/runtime-functions";

const getConvexClient = () => {
  const convexUrl = env.CONVEX_URL?.trim();

  if (!convexUrl) {
    throw new Error("Missing CONVEX_URL.");
  }

  return createConvexServerClient(convexUrl);
};

const normalizeVersionInput = (
  versionId: string | null | undefined,
  searchParams: URLSearchParams,
) => {
  if (!versionId) {
    return {
      searchParams,
      versionId: undefined,
    };
  }

  const [cleanVersionId, appendedQuery] = versionId.split("?", 2);

  if (!appendedQuery) {
    return {
      searchParams,
      versionId: cleanVersionId as Id<"pageVersions">,
    };
  }

  const mergedSearchParams = new URLSearchParams(searchParams);

  for (const [key, value] of new URLSearchParams(appendedQuery)) {
    if (!mergedSearchParams.has(key)) {
      mergedSearchParams.set(key, value);
    }
  }

  return {
    searchParams: mergedSearchParams,
    versionId: cleanVersionId as Id<"pageVersions">,
  };
};

const readText = async (url: string | null) => {
  if (!url) {
    return null;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch generated artifact (${response.status}).`);
  }

  return response.text();
};

const getAsyncFunction = () =>
  Object.getPrototypeOf(async function placeholder() {}).constructor as new (
    ...args: string[]
  ) => (ctx: {
    callFunction: (name: string, args: unknown) => Promise<unknown>;
    searchParams: URLSearchParams;
  }) => Promise<unknown>;

export const getGeneratedPageBundle = async (input: {
  readonly slug: string;
  readonly versionId?: string | null;
}) => {
  // TODO: This currently runs same-origin with the dashboard in dev.
  // Split this runtime onto a dedicated origin before hardening production sandboxing.
  const normalized = normalizeVersionInput(
    input.versionId,
    new URLSearchParams(),
  );
  const convex = getConvexClient();
  const payload = await convex.query(api.pages.getRuntimePage, {
    slug: input.slug,
    versionId: normalized.versionId,
  });

  if (!payload || payload.version.status !== "ready") {
    return null;
  }

  const [html, css, js] = await Promise.all([
    readText(payload.version.htmlUrl),
    readText(payload.version.cssUrl),
    readText(payload.version.jsUrl),
  ]);

  if (html === null || css === null || js === null) {
    return null;
  }

  return {
    page: {
      css,
      html,
      js,
      title: payload.version.title,
    },
    version: {
      id: payload.version._id,
    },
  };
};

export const runGeneratedEndpoint = async (input: {
  readonly endpointSlug: string;
  readonly searchParams: URLSearchParams;
  readonly slug: string;
  readonly versionId?: string | null;
}) => {
  // TODO: Same-origin execution is temporary. Keep this boundary narrow so it can
  // move behind a dedicated runtime origin later without changing generated code.
  if (input.endpointSlug !== "data") {
    return null;
  }

  const normalized = normalizeVersionInput(input.versionId, input.searchParams);
  const convex = getConvexClient();
  const payload = await convex.query(api.pages.getRuntimePage, {
    slug: input.slug,
    versionId: normalized.versionId,
  });

  if (!payload || payload.version.status !== "ready") {
    return null;
  }

  const endpointSource = await readText(payload.version.endpointUrl);

  if (endpointSource === null) {
    return null;
  }
  const callFunction = async (name: string, args: unknown) => {
    const startedAt = Date.now();

    try {
      const result = await callRuntimeFunction({
        args,
        name,
      });

      console.log(
        JSON.stringify({
          durationMs: Date.now() - startedAt,
          functionName: name,
          scope: "generated-page.runtime-function",
          slug: input.slug,
          timestamp: new Date().toISOString(),
          versionId: payload.version._id,
        }),
      );

      return result;
    } catch (cause) {
      console.error(
        JSON.stringify({
          durationMs: Date.now() - startedAt,
          errorMessage:
            cause instanceof Error
              ? cause.message
              : "Unknown runtime function failure.",
          functionName: name,
          scope: "generated-page.runtime-function",
          slug: input.slug,
          timestamp: new Date().toISOString(),
          versionId: payload.version._id,
        }),
      );

      throw cause;
    }
  };

  const AsyncFunction = getAsyncFunction();
  const execute = new AsyncFunction("ctx", endpointSource);

  return execute({
    callFunction,
    searchParams: normalized.searchParams,
  });
};
