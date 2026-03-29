import { error } from "@sveltejs/kit";
import { toSandboxDocument } from "@ns-sentinel/runtime-core";
import { getGeneratedPageBundle } from "$lib/server/generated-apps";

export const GET = async ({ params, url }) => {
  const bundle = await getGeneratedPageBundle({
    slug: params.slug,
    versionId: url.searchParams.get("version"),
  });

  if (!bundle) {
    throw error(404, "Generated sandbox page not found.");
  }

  return new Response(
    toSandboxDocument({
      endpointPath: `/sandbox-api/${params.slug}/data?version=${bundle.version.id}`,
      page: bundle.page,
      slug: params.slug,
      title: bundle.page.title,
      versionId: bundle.version.id,
    }),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
};
