import { json } from "@sveltejs/kit";
import type { Id } from "@ns-sentinel/convex/data-model";
import { retryGeneratedPageVersion } from "$lib/server/generated-pages";

export const POST = async ({ params }) => {
  const result = await retryGeneratedPageVersion(
    params.versionId as Id<"pageVersions">,
  );

  return json(result, { status: 202 });
};
