import { json } from "@sveltejs/kit";
import { createGeneratedDemoRun } from "$lib/server/generated-demo-runs";

export const POST = async ({ request }) => {
  const body = (await request.json()) as {
    prompt?: string;
  };

  const snapshot = createGeneratedDemoRun({
    prompt: body.prompt ?? "",
  });

  return json(snapshot, { status: 201 });
};
