import { json } from "@sveltejs/kit";
import { createGeneratedAppEditRun } from "$lib/server/generated-apps";

export const POST = async ({ params, request }) => {
  const body = (await request.json()) as {
    prompt?: string;
  };

  const snapshot = await createGeneratedAppEditRun({
    prompt: body.prompt ?? "",
    slug: params.slug,
  });

  return json(snapshot, { status: 201 });
};
