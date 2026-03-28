import { error } from "@sveltejs/kit";
import {
  getGeneratedDemoSnapshot,
  getLatestGeneratedDemoRunForSlug,
} from "$lib/server/generated-demo-runs";

export const load = ({ params, url }) => {
  const runId = url.searchParams.get("run");
  const snapshot = runId
    ? getGeneratedDemoSnapshot(runId)
    : getLatestGeneratedDemoRunForSlug(params.slug)?.id
      ? getGeneratedDemoSnapshot(
          getLatestGeneratedDemoRunForSlug(params.slug)!.id,
        )
      : null;

  if (!snapshot || snapshot.slug !== params.slug) {
    throw error(404, "Generated page not found.");
  }

  return {
    snapshot,
    slug: params.slug,
  };
};
