import { json } from "@sveltejs/kit";
import { createGeneratedAppRun } from "$lib/server/generated-apps";
import { toGeneratedSnapshotResponse } from "$lib/server/generated-snapshot-response";

export const POST = async ({ request, url }) => {
  const body = (await request.json()) as {
    prompt?: string;
  };

  const snapshot = await createGeneratedAppRun(body.prompt ?? "");

  return json(toGeneratedSnapshotResponse(snapshot, url), { status: 201 });
};
