/**
 * Getting started:
 * 1. Create an app in the X Developer Console and generate a Bearer Token for app-only auth.
 * 2. Export `X_BEARER_TOKEN`.
 * 3. Optionally export `X_USERNAME` to override the default public account lookup.
 *
 * Useful links:
 * - https://docs.x.com/x-api/getting-started/getting-access
 * - https://docs.x.com/xdks/typescript/overview
 * - https://docs.x.com/fundamentals/authentication/oauth-2-0/application-only
 * - https://docs.x.com/x-api/users/lookup/integrate
 */

import { Client } from "@xdevplatform/xdk";

const bearerToken = process.env.X_BEARER_TOKEN;

if (!bearerToken) {
  throw new Error("Missing X_BEARER_TOKEN.");
}

const username = process.env.X_USERNAME ?? "XDevelopers";
const client = new Client({ bearerToken });
const response = await client.users.getByUsername(username, {
  userFields: ["description", "public_metrics", "verified", "created_at"],
});

if (!response.data) {
  throw new Error(`No X user was returned for username "${username}".`);
}

console.log(
  JSON.stringify(
    {
      id: response.data.id,
      name: response.data.name,
      username: response.data.username,
      description: response.data.description,
      verified: response.data.verified,
      createdAt: response.data.createdAt,
      publicMetrics: response.data.publicMetrics,
    },
    null,
    2,
  ),
);
