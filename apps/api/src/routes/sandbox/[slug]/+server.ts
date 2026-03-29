import { error } from "@sveltejs/kit";
import { getGeneratedPageBundle } from "$lib/server/generated-apps";

const escapeForScript = (value: string) =>
  value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"').replace(/</gu, "\\u003c");

const toSandboxDocument = (input: {
  readonly endpointSlug: string;
  readonly page: {
    readonly css: string;
    readonly html: string;
    readonly js: string;
  };
  readonly runId: string;
  readonly slug: string;
  readonly title: string;
}) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover"
    />
    <title>${input.title}</title>
    <style>
      html,
      body {
        margin: 0;
        min-height: 100%;
      }

      :root {
        color-scheme: light;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(245, 180, 116, 0.22), transparent 28rem),
          linear-gradient(180deg, #fffaf3 0%, #f5efe5 100%);
        color: #1c1917;
      }

      * {
        box-sizing: border-box;
      }

      body {
        min-height: 100vh;
      }
    </style>
    <style>${input.page.css}</style>
  </head>
  <body>
    ${input.page.html}

    <script>
      window.__GENERATED_APP__ = {
        endpointUrl: "/sandbox-api/${input.slug}/${input.endpointSlug}?run=${input.runId}",
        runId: "${input.runId}",
        slug: "${input.slug}",
        title: "${escapeForScript(input.title)}"
      };
    </script>
    <script>${input.page.js}</script>
  </body>
</html>`;

export const GET = async ({ params, url }) => {
  const bundle = await getGeneratedPageBundle({
    runId: url.searchParams.get("run"),
    slug: params.slug,
  });

  if (!bundle) {
    throw error(404, "Generated sandbox page not found.");
  }

  return new Response(
    toSandboxDocument({
      endpointSlug: bundle.page.endpointSlug,
      page: bundle.page,
      runId: bundle.version.id,
      slug: bundle.app.slug,
      title: bundle.page.title,
    }),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
};
