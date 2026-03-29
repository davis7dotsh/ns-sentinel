import {
  copyGeneratedApiHeaders,
  fetchGeneratedApi,
} from "$lib/server/generated-api";

export const GET = async ({ params }) => {
  const response = await fetchGeneratedApi(
    `/api/generated-demo/runs/${params.runId}/events`,
    {
      headers: {
        Accept: "text/event-stream",
      },
    },
  );

  return new Response(response.body, {
    headers: copyGeneratedApiHeaders(response.headers),
    status: response.status,
  });
};
