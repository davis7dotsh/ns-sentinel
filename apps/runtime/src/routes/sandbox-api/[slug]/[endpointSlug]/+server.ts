import { error, json } from "@sveltejs/kit";
import { runGeneratedEndpoint } from "$lib/server/generated-apps";

const handleRequest = async ({
  params,
  url,
}: {
  params: {
    endpointSlug: string;
    slug: string;
  };
  url: URL;
}) => {
  const result = await runGeneratedEndpoint({
    endpointSlug: params.endpointSlug,
    searchParams: url.searchParams,
    slug: params.slug,
    versionId: url.searchParams.get("version"),
  });

  if (result === null) {
    throw error(404, "Generated endpoint not found.");
  }

  return json(result);
};

export const GET = handleRequest;
export const POST = handleRequest;
