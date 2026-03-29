import { error, json } from "@sveltejs/kit";
import type { Id } from "@ns-sentinel/convex/data-model";
import { createGeneratedPageEdit } from "$lib/server/generated-pages";

export const POST = async ({ params, request }) => {
  const body = (await request.json()) as {
    baseVersionId?: string;
    prompt?: string;
  };

  if (!body.baseVersionId) {
    throw error(400, "Missing baseVersionId.");
  }

  const created = await createGeneratedPageEdit({
    baseVersionId: body.baseVersionId as Id<"pageVersions">,
    prompt: body.prompt ?? "",
    slug: params.slug,
  });

  return json(created, { status: 201 });
};
