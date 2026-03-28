import { error, json } from "@sveltejs/kit";
import { runGeneratedEndpoint } from "$lib/server/generated-apps";

export const GET = async ({ params, url }) => {
  const result = await runGeneratedEndpoint({
    endpointSlug: params.endpointSlug,
    runId: url.searchParams.get("run"),
    searchParams: url.searchParams,
    slug: params.slug,
  });

  if (result === null) {
    throw error(404, "Generated endpoint not found.");
  }

  return json(result);
};
