import { env } from "$env/dynamic/private";
import { error } from "@sveltejs/kit";
import { createConvexPublicServerClient } from "@ns-sentinel/convex";
import { api } from "@ns-sentinel/convex/api";
import type { Id } from "@ns-sentinel/convex/data-model";

export const load = async ({ params, url }) => {
  const convexUrl = env.CONVEX_URL?.trim();

  if (!convexUrl) {
    throw new Error("Missing CONVEX_URL.");
  }

  const selectedVersionId = url.searchParams.get("version");
  const convex = createConvexPublicServerClient(convexUrl);
  const initialPageView = await convex.query(api.pages.getPageView, {
    slug: params.slug,
    versionId: selectedVersionId ? (selectedVersionId as Id<"pageVersions">) : undefined,
  });

  if (!initialPageView) {
    throw error(404, "Generated page not found.");
  }

  return {
    initialPageView,
    selectedVersionId,
    slug: params.slug,
  };
};
