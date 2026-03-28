import { json } from "@sveltejs/kit";
import { createGeneratedAppRun } from "$lib/server/generated-apps";

export const POST = async ({ request }) => {
  const body = (await request.json()) as {
    prompt?: string;
  };

  const snapshot = await createGeneratedAppRun(body.prompt ?? "");

  return json(snapshot, { status: 201 });
};
