/**
 * Getting started:
 * 1. In Google Cloud, create or reuse a project and enable the Gmail API.
 * 2. Create an OAuth client for a desktop app and download the client JSON into `packages/gmail-read/credentials.json`.
 * 3. Run `bun run test:gmail` from the repo root. The first run opens a browser, asks for `gmail.readonly`, and saves a local `token.json`.
 * 4. Optionally export `GMAIL_QUERY` to filter the sample inbox search.
 *
 * Useful links:
 * - https://developers.google.com/workspace/gmail/api/quickstart/nodejs
 * - https://developers.google.com/workspace/gmail/api/auth/scopes
 * - https://console.cloud.google.com/apis/library/gmail.googleapis.com
 */

import { authenticate } from "@google-cloud/local-auth";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const scopes = ["https://www.googleapis.com/auth/gmail.readonly"];
const packageDir = fileURLToPath(new URL("..", import.meta.url));
const credentialsPath = resolve(
  packageDir,
  process.env.GMAIL_CREDENTIALS_PATH ?? "credentials.json",
);
const tokenPath = resolve(
  packageDir,
  process.env.GMAIL_TOKEN_PATH ?? "token.json",
);

const loadOAuthClient = async () => {
  if (!existsSync(credentialsPath)) {
    throw new Error(
      `Missing Gmail OAuth client JSON at ${credentialsPath}. Download it from Google Cloud and place it there, or set GMAIL_CREDENTIALS_PATH.`,
    );
  }

  const rawCredentials = JSON.parse(await readFile(credentialsPath, "utf8"));
  const credentials = rawCredentials.installed ?? rawCredentials.web;

  if (!credentials) {
    throw new Error(
      "credentials.json must contain an installed or web OAuth client.",
    );
  }

  const client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    credentials.redirect_uris[0],
  );

  if (existsSync(tokenPath)) {
    client.setCredentials(JSON.parse(await readFile(tokenPath, "utf8")));
    return client;
  }

  const authenticatedClient = await authenticate({
    scopes,
    keyfilePath: credentialsPath,
  });

  client.setCredentials(authenticatedClient.credentials);

  await writeFile(
    tokenPath,
    JSON.stringify(authenticatedClient.credentials, null, 2),
  );

  return client;
};

const getHeader = (
  headers: { name?: string | null; value?: string | null }[],
  name: string,
) =>
  headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())
    ?.value ?? null;

const auth = await loadOAuthClient();
const gmail = google.gmail({ version: "v1", auth });
const searchQuery = process.env.GMAIL_QUERY;
const profile = await gmail.users.getProfile({ userId: "me" });
const listResponse = await gmail.users.messages.list({
  userId: "me",
  maxResults: 5,
  q: searchQuery,
});

const sampleMessages = await Promise.all(
  (listResponse.data.messages ?? []).map(async (message) => {
    if (!message.id) {
      return null;
    }

    const details = await gmail.users.messages.get({
      userId: "me",
      id: message.id,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "Date"],
    });

    const headers = details.data.payload?.headers ?? [];

    return {
      id: message.id,
      subject: getHeader(headers, "Subject"),
      from: getHeader(headers, "From"),
      date: getHeader(headers, "Date"),
    };
  }),
);

console.log(
  JSON.stringify(
    {
      emailAddress: profile.data.emailAddress,
      messagesTotal: profile.data.messagesTotal,
      threadsTotal: profile.data.threadsTotal,
      query: searchQuery ?? "",
      sampleMessages: sampleMessages.filter(Boolean),
    },
    null,
    2,
  ),
);
