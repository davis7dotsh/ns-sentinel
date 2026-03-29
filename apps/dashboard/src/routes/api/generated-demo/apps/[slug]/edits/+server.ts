import {
  copyGeneratedApiHeaders,
  fetchGeneratedApi,
} from "$lib/server/generated-api";

export const POST = async ({ params, request }) => {
  const response = await fetchGeneratedApi(
    `/api/generated-demo/apps/${params.slug}/edits`,
    {
      body: await request.text(),
      headers: {
        "Content-Type":
          request.headers.get("content-type") ?? "application/json",
      },
      method: "POST",
    },
  );

  return new Response(response.body, {
    headers: copyGeneratedApiHeaders(response.headers),
    status: response.status,
  });
};
