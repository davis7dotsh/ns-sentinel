import { error } from "@sveltejs/kit";
import { fetchGeneratedApi } from "$lib/server/generated-api";

export const load = async ({ params, url }) => {
  const response = await fetchGeneratedApi(
    `/api/generated-demo/apps/${params.slug}`,
    undefined,
    url.searchParams,
  );

  if (!response.ok) {
    throw error(404, "Generated page not found.");
  }

  const snapshot = (await response.json()) as {
    readonly slug: string;
  };

  if (snapshot.slug !== params.slug) {
    throw error(404, "Generated page not found.");
  }

  return {
    snapshot,
    slug: params.slug,
  };
};
