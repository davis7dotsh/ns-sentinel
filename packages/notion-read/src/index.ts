/**
 * Getting started:
 * 1. Create an internal integration in Notion and grant it only the "Read content" capability.
 * 2. Share the specific page or data source you want this script to read with that integration.
 * 3. Export `NOTION_TOKEN` with the integration secret.
 * 4. Optionally export `NOTION_PAGE_ID` to retrieve one page directly, or `NOTION_QUERY` to narrow the search example.
 *
 * Useful links:
 * - https://developers.notion.com/guides/get-started/create-a-notion-integration
 * - https://developers.notion.com/reference/capabilities
 * - https://developers.notion.com/reference/post-search
 */

import { Client } from "@notionhq/client";

const notionToken = process.env.NOTION_TOKEN;

if (!notionToken) {
  throw new Error("Missing NOTION_TOKEN.");
}

const notion = new Client({ auth: notionToken });
const notionPageId = process.env.NOTION_PAGE_ID;
const notionQuery = process.env.NOTION_QUERY;

if (notionPageId) {
  const page = await notion.pages.retrieve({ page_id: notionPageId });

  console.log(
    JSON.stringify(
      {
        mode: "page",
        object: page.object,
        id: page.id,
        url: "url" in page ? page.url : undefined,
      },
      null,
      2,
    ),
  );
} else {
  const response = await notion.search({
    query: notionQuery,
    filter: {
      property: "object",
      value: "page",
    },
    page_size: 5,
  });

  console.log(
    JSON.stringify(
      {
        mode: "search",
        query: notionQuery ?? "",
        results: response.results.map((result) => ({
          object: result.object,
          id: result.id,
          url: "url" in result ? result.url : undefined,
        })),
      },
      null,
      2,
    ),
  );
}
