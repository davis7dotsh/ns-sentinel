import { json } from "@sveltejs/kit";
import { createGeneratedAppEditRun } from "$lib/server/generated-apps";
import { toGeneratedSnapshotResponse } from "$lib/server/generated-snapshot-response";

export const POST = async ({ params, request, url }) => {
  const body = (await request.json()) as {
    prompt?: string;
  };

  const snapshot = await createGeneratedAppEditRun({
    prompt: body.prompt ?? "",
    slug: params.slug,
  });

  return json(toGeneratedSnapshotResponse(snapshot, url), { status: 201 });
};
