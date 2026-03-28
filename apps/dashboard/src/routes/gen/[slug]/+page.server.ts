import { error } from "@sveltejs/kit";
import { getGeneratedAppSnapshot } from "$lib/server/generated-apps";

export const load = async ({ params, url }) => {
  const snapshot = await getGeneratedAppSnapshot({
    runId: url.searchParams.get("run"),
    slug: params.slug,
  });

  if (!snapshot || snapshot.slug !== params.slug) {
    throw error(404, "Generated page not found.");
  }

  return {
    snapshot,
    slug: params.slug,
  };
};
