import { env } from "$env/dynamic/private";
import { createConvexServerClient } from "@ns-sentinel/convex";
import { api } from "@ns-sentinel/convex/api";
import type { Id } from "@ns-sentinel/convex/data-model";
import {
  getGeneratedChannelsCatalogData,
  getLatestGeneratedChannelOverviewData,
} from "@ns-sentinel/data-access";

const getConvexClient = () => {
  const convexUrl = env.CONVEX_URL?.trim();

  if (!convexUrl) {
    throw new Error("Missing CONVEX_URL.");
  }

  return createConvexServerClient(convexUrl);
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
    fetchJson: (path: string) => Promise<unknown>;
    searchParams: URLSearchParams;
  }) => Promise<unknown>;

export const getGeneratedPageBundle = async (input: {
  readonly slug: string;
  readonly versionId?: string | null;
}) => {
  // TODO: This currently runs same-origin with the dashboard in dev.
  // Split this runtime onto a dedicated origin before hardening production sandboxing.
  const convex = getConvexClient();
  const payload = await convex.query(api.pages.getRuntimePage, {
    slug: input.slug,
    versionId: input.versionId
      ? (input.versionId as Id<"pageVersions">)
      : undefined,
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

  const convex = getConvexClient();
  const payload = await convex.query(api.pages.getRuntimePage, {
    slug: input.slug,
    versionId: input.versionId
      ? (input.versionId as Id<"pageVersions">)
      : undefined,
  });

  if (!payload || payload.version.status !== "ready") {
    return null;
  }

  const endpointSource = await readText(payload.version.endpointUrl);

  if (endpointSource === null) {
    return null;
  }

  const allowedPaths = new Set([
    "/internal/read/channels",
    "/internal/read/channels/latest/overview",
  ]);

  const fetchJson = async (path: string) => {
    if (!allowedPaths.has(path)) {
      throw new Error(`The generated endpoint cannot access "${path}".`);
    }

    return path === "/internal/read/channels"
      ? getGeneratedChannelsCatalogData()
      : getLatestGeneratedChannelOverviewData();
  };

  const AsyncFunction = getAsyncFunction();
  const execute = new AsyncFunction("ctx", endpointSource);

  return execute({
    fetchJson,
    searchParams: input.searchParams,
  });
};
