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

export const generateGeneratedPageVersionTask = task({
  id: "generated-page.generate-version",
  maxDuration: 3_600,
  run: async (payload: { versionId: Id<"pageVersions"> }) => {
    const convex = getConvexClient();

    try {
      await convex.mutation(api.pages.markVersionWorking, {
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

      await convex.action(api.pages.storeVersionArtifacts, {
        css: artifacts.css,
        endpoint: artifacts.endpoint,
        html: artifacts.html,
        js: artifacts.js,
        title: artifacts.title,
        versionId: payload.versionId,
      });

      return {
        status: "ready" as const,
        versionId: payload.versionId,
      };
    } catch (cause) {
      await convex.mutation(api.pages.markVersionError, {
        errorMessage: toErrorMessage(cause),
        versionId: payload.versionId,
      });

      throw cause;
    }
  },
});
