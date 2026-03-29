import { error, json } from "@sveltejs/kit";
import { getGeneratedAppSnapshot } from "$lib/server/generated-apps";
import { toGeneratedSnapshotResponse } from "$lib/server/generated-snapshot-response";

export const GET = async ({ params, url }) => {
  const snapshot = await getGeneratedAppSnapshot({
    runId: url.searchParams.get("run"),
    slug: params.slug,
  });

  if (!snapshot) {
    throw error(404, "Generated page not found.");
  }

  return json(toGeneratedSnapshotResponse(snapshot, url));
};
