import { error } from "@sveltejs/kit";
import {
  copyGeneratedApiHeaders,
  fetchGeneratedApi,
} from "$lib/server/generated-api";

export const GET = async ({ params, url }) => {
  const response = await fetchGeneratedApi(
    `/api/generated-demo/apps/${params.slug}`,
    undefined,
    url.searchParams,
  );

  if (!response.ok) {
    throw error(response.status, await response.text());
  }

  return new Response(response.body, {
    headers: copyGeneratedApiHeaders(response.headers),
    status: response.status,
  });
};
