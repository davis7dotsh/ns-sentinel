import {
  copyGeneratedApiHeaders,
  fetchGeneratedApi,
} from "$lib/server/generated-api";

const handleRequest = async ({
  params,
  request,
  url,
}: {
  params: {
    endpointSlug: string;
    slug: string;
  };
  request: Request;
  url: URL;
}) => {
  const response = await fetchGeneratedApi(
    `/sandbox-api/${params.slug}/${params.endpointSlug}`,
    {
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.text(),
      headers: {
        "Content-Type":
          request.headers.get("content-type") ?? "application/json",
      },
      method: request.method,
    },
    url.searchParams,
  );

  return new Response(response.body, {
    headers: copyGeneratedApiHeaders(response.headers),
    status: response.status,
  });
};

export const GET = handleRequest;
export const POST = handleRequest;
