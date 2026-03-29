import {
  copyGeneratedApiHeaders,
  fetchGeneratedApi,
} from "$lib/server/generated-api";

export const GET = async ({ params, url }) => {
  const response = await fetchGeneratedApi(
    `/sandbox-api/${params.slug}/${params.endpointSlug}`,
    undefined,
    url.searchParams,
  );

  return new Response(response.body, {
    headers: copyGeneratedApiHeaders(response.headers),
    status: response.status,
  });
};
