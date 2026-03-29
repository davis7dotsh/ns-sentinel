import { json } from "@sveltejs/kit";
import { createGeneratedPage } from "$lib/server/generated-pages";

export const POST = async ({ request }) => {
  const body = (await request.json()) as {
    prompt?: string;
  };
  const created = await createGeneratedPage(body.prompt ?? "");

  return json(created, { status: 201 });
};
