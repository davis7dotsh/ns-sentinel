import { task } from "@trigger.dev/sdk";
import {
  createConvexServerClient,
  type ConvexServerError,
} from "@ns-sentinel/convex";
import { api } from "@ns-sentinel/convex/api";
import type { Id } from "@ns-sentinel/convex/data-model";
import {
  getGeneratedChannelsCatalogData,
  getLatestGeneratedChannelOverviewData,
} from "@ns-sentinel/data-access";
import { generatePageArtifacts } from "@ns-sentinel/page-agent";

const getRequiredConvexUrl = () => {
  const value = process.env.CONVEX_URL?.trim();

  if (!value) {
    throw new Error("Missing CONVEX_URL.");
  }

  return value;
};

const getConvexClient = () => createConvexServerClient(getRequiredConvexUrl());

const toErrorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : "Generated page creation failed.";

const logStep = (
  message: string,
  details: Record<string, string | number | boolean | null | undefined> = {},
) => {
  console.log(
    JSON.stringify({
      details,
      message,
      scope: "generated-page.generate-version",
      timestamp: new Date().toISOString(),
    }),
  );
};

export const generateGeneratedPageVersionTask = task({
  id: "generated-page.generate-version",
  maxDuration: 3_600,
  run: async (payload: { versionId: Id<"pageVersions"> }) => {
    const convex = getConvexClient();

    try {
      logStep("Starting generation run", {
        versionId: payload.versionId,
      });

      await convex.mutation(api.pages.markVersionWorking, {
        versionId: payload.versionId,
      });

      logStep("Marked version as working", {
        versionId: payload.versionId,
      });

      const [context, channelsSample, latestOverviewSample] = await Promise.all(
        [
          convex.query(api.pages.getGenerationContext, {
            versionId: payload.versionId,
          }),
          getGeneratedChannelsCatalogData(),
          getLatestGeneratedChannelOverviewData(),
        ],
      );

      logStep("Loaded generation context and samples", {
        channelCount: channelsSample.length,
        hasBaseVersion: context.baseVersion !== null,
        pageSlug: context.page.slug,
        promptLength: context.version.prompt.length,
        versionId: payload.versionId,
        versionNumber: context.version.versionNumber,
        videoSampleCount: latestOverviewSample.videos.length,
        xPostSampleCount: latestOverviewSample.posts.length,
      });

      const artifacts = await generatePageArtifacts({
        channelsSample: channelsSample.slice(0, 4),
        latestOverviewSample: latestOverviewSample.channel
          ? {
              ...latestOverviewSample,
              posts: latestOverviewSample.posts.slice(0, 2),
              videos: latestOverviewSample.videos.slice(0, 2),
            }
          : latestOverviewSample,
        prompt: context.version.prompt,
        selectedVersion: context.baseVersion
          ? {
              css: context.baseVersion.css,
              endpoint: context.baseVersion.endpoint,
              html: context.baseVersion.html,
              js: context.baseVersion.js,
              prompt: context.baseVersion.prompt,
              title: context.baseVersion.title,
              versionNumber: context.baseVersion.versionNumber,
            }
          : null,
        slug: context.page.slug,
        versionId: payload.versionId,
      });

      logStep("Generated page artifacts", {
        cssLength: artifacts.css.length,
        endpointLength: artifacts.endpoint.length,
        htmlLength: artifacts.html.length,
        jsLength: artifacts.js.length,
        pageSlug: context.page.slug,
        title: artifacts.title,
        versionId: payload.versionId,
      });

      await convex.action(api.pages.storeVersionArtifacts, {
        css: artifacts.css,
        endpoint: artifacts.endpoint,
        html: artifacts.html,
        js: artifacts.js,
        title: artifacts.title,
        versionId: payload.versionId,
      });

      logStep("Stored generated artifacts in Convex", {
        pageSlug: context.page.slug,
        title: artifacts.title,
        versionId: payload.versionId,
      });

      return {
        status: "ready" as const,
        versionId: payload.versionId,
      };
    } catch (cause) {
      console.error(
        JSON.stringify({
          errorMessage: toErrorMessage(cause),
          scope: "generated-page.generate-version",
          timestamp: new Date().toISOString(),
          versionId: payload.versionId,
        }),
      );

      await convex.mutation(api.pages.markVersionError, {
        errorMessage: toErrorMessage(cause),
        versionId: payload.versionId,
      });

      throw cause;
    }
  },
});
