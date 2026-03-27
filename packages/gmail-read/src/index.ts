/**
 * Getting started:
 * 1. In Google Cloud, create or reuse a project and enable the Gmail API.
 * 2. Create an OAuth client for a desktop app and download the client JSON into `packages/gmail-read/credentials.json`.
 * 3. Run `bun run test:gmail` from the repo root. The first run opens a browser, asks for `gmail.readonly`, and saves a local `token.json`.
 * 4. Optionally export `GMAIL_QUERY` to filter the sample inbox search.
 */

import { authenticate } from "@google-cloud/local-auth";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { google } from "googleapis";
import { Config, Effect, Layer, Option, ServiceMap } from "effect";
import {
  createSentinelError,
  resolvePackageDir,
  runNodeMain,
  withEnvConfig,
} from "@ns-sentinel/core";

const scopes = ["https://www.googleapis.com/auth/gmail.readonly"];
const packageDir = resolvePackageDir(import.meta.url);
const defaultCredentialsPath = resolve(packageDir, "credentials.json");
const defaultTokenPath = resolve(packageDir, "token.json");

const GmailConfigSource = Config.all({
  credentialsPath: Config.string("GMAIL_CREDENTIALS_PATH").pipe(
    Config.withDefault(defaultCredentialsPath),
  ),
  tokenPath: Config.string("GMAIL_TOKEN_PATH").pipe(
    Config.withDefault(defaultTokenPath),
  ),
  query: Config.option(Config.string("GMAIL_QUERY")),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseCredentials = (value: unknown) => {
  if (!isRecord(value)) {
    return Effect.fail(
      createSentinelError({
        module: "@ns-sentinel/gmail-read",
        operation: "parseCredentials",
        message: "credentials.json must contain a JSON object.",
      }),
    );
  }

  const candidate = isRecord(value.installed)
    ? value.installed
    : isRecord(value.web)
      ? value.web
      : null;

  if (candidate === null) {
    return Effect.fail(
      createSentinelError({
        module: "@ns-sentinel/gmail-read",
        operation: "parseCredentials",
        message:
          "credentials.json must contain an installed or web OAuth client.",
      }),
    );
  }

  const { client_id, client_secret, redirect_uris } = candidate;

  if (
    typeof client_id !== "string" ||
    typeof client_secret !== "string" ||
    !Array.isArray(redirect_uris) ||
    redirect_uris.length === 0 ||
    redirect_uris.some((value) => typeof value !== "string")
  ) {
    return Effect.fail(
      createSentinelError({
        module: "@ns-sentinel/gmail-read",
        operation: "parseCredentials",
        message: "credentials.json is missing required OAuth fields.",
      }),
    );
  }

  return Effect.succeed({
    clientId: client_id,
    clientSecret: client_secret,
    redirectUri: redirect_uris[0],
  });
};

const getHeader = (
  headers: { name?: string | null; value?: string | null }[],
  name: string,
) =>
  headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())
    ?.value ?? null;

export class GmailReadConfig extends ServiceMap.Service<
  GmailReadConfig,
  {
    readonly credentialsPath: string;
    readonly tokenPath: string;
    readonly query: Option.Option<string>;
  }
>()("GmailReadConfig", {
  make: withEnvConfig(GmailConfigSource.asEffect()),
}) {
  static readonly layer = Layer.effect(this)(this.make);
}

export class GmailReader extends ServiceMap.Service<
  GmailReader,
  {
    readonly readMailbox: () => Effect.Effect<
      {
        readonly emailAddress: string | null | undefined;
        readonly messagesTotal: number | null | undefined;
        readonly threadsTotal: number | null | undefined;
        readonly query: string;
        readonly sampleMessages: readonly {
          readonly id: string;
          readonly subject: string | null;
          readonly from: string | null;
          readonly date: string | null;
        }[];
      },
      ReturnType<typeof createSentinelError>
    >;
  }
>()("GmailReader") {
  static readonly layer = Layer.effect(this)(
    Effect.gen(function* () {
      const config = yield* GmailReadConfig;

      const loadOAuthClient = Effect.gen(function* () {
        if (!existsSync(config.credentialsPath)) {
          return yield* Effect.fail(
            createSentinelError({
              module: "@ns-sentinel/gmail-read",
              operation: "loadOAuthClient",
              message: `Missing Gmail OAuth client JSON at ${config.credentialsPath}.`,
            }),
          );
        }

        const rawCredentials = yield* Effect.tryPromise({
          try: () => readFile(config.credentialsPath, "utf8"),
          catch: (cause) =>
            createSentinelError({
              module: "@ns-sentinel/gmail-read",
              operation: "readCredentials",
              message: "Failed to read the Gmail credentials file.",
              cause,
            }),
        });

        const parsed = yield* Effect.try({
          try: () => JSON.parse(rawCredentials) as unknown,
          catch: (cause) =>
            createSentinelError({
              module: "@ns-sentinel/gmail-read",
              operation: "parseCredentialsJson",
              message: "Failed to parse the Gmail credentials JSON.",
              cause,
            }),
        });

        const credentials = yield* parseCredentials(parsed);
        const client = new google.auth.OAuth2(
          credentials.clientId,
          credentials.clientSecret,
          credentials.redirectUri,
        );

        if (existsSync(config.tokenPath)) {
          const tokenContents = yield* Effect.tryPromise({
            try: () => readFile(config.tokenPath, "utf8"),
            catch: (cause) =>
              createSentinelError({
                module: "@ns-sentinel/gmail-read",
                operation: "readToken",
                message: "Failed to read the Gmail token file.",
                cause,
              }),
          });

          const token = yield* Effect.try({
            try: () => JSON.parse(tokenContents) as unknown,
            catch: (cause) =>
              createSentinelError({
                module: "@ns-sentinel/gmail-read",
                operation: "parseToken",
                message: "Failed to parse the Gmail token JSON.",
                cause,
              }),
          });

          if (!isRecord(token)) {
            return yield* Effect.fail(
              createSentinelError({
                module: "@ns-sentinel/gmail-read",
                operation: "parseToken",
                message: "token.json must contain a JSON object.",
              }),
            );
          }

          client.setCredentials(token);
          return client;
        }

        const authenticatedClient = yield* Effect.tryPromise({
          try: () =>
            authenticate({
              scopes,
              keyfilePath: config.credentialsPath,
            }),
          catch: (cause) =>
            createSentinelError({
              module: "@ns-sentinel/gmail-read",
              operation: "authenticate",
              message: "Failed to complete the Gmail OAuth flow.",
              cause,
            }),
        });

        client.setCredentials(authenticatedClient.credentials);

        yield* Effect.tryPromise({
          try: () =>
            writeFile(
              config.tokenPath,
              JSON.stringify(authenticatedClient.credentials, null, 2),
            ),
          catch: (cause) =>
            createSentinelError({
              module: "@ns-sentinel/gmail-read",
              operation: "writeToken",
              message: "Failed to persist the Gmail OAuth token.",
              cause,
            }),
        });

        return client;
      });

      return GmailReader.of({
        readMailbox: () =>
          Effect.gen(function* () {
            const auth = yield* loadOAuthClient;
            const gmail = google.gmail({ version: "v1", auth });
            const query = Option.getOrElse(config.query, () => "");

            const profile = yield* Effect.tryPromise({
              try: () => gmail.users.getProfile({ userId: "me" }),
              catch: (cause) =>
                createSentinelError({
                  module: "@ns-sentinel/gmail-read",
                  operation: "getProfile",
                  message: "Failed to load the Gmail profile.",
                  cause,
                }),
            });

            const listResponse = yield* Effect.tryPromise({
              try: () =>
                gmail.users.messages.list({
                  userId: "me",
                  maxResults: 5,
                  q: Option.getOrUndefined(config.query),
                }),
              catch: (cause) =>
                createSentinelError({
                  module: "@ns-sentinel/gmail-read",
                  operation: "listMessages",
                  message: "Failed to list Gmail messages.",
                  cause,
                }),
            });

            const sampleMessages = yield* Effect.forEach(
              listResponse.data.messages ?? [],
              (message) =>
                Effect.gen(function* () {
                  const messageId = message.id;

                  if (!messageId) {
                    return null;
                  }

                  const details = yield* Effect.tryPromise({
                    try: () =>
                      gmail.users.messages.get({
                        userId: "me",
                        id: messageId,
                        format: "metadata",
                        metadataHeaders: ["Subject", "From", "Date"],
                      }),
                    catch: (cause) =>
                      createSentinelError({
                        module: "@ns-sentinel/gmail-read",
                        operation: "getMessage",
                        message: `Failed to load Gmail message ${messageId}.`,
                        cause,
                      }),
                  });

                  const headers = details.data.payload?.headers ?? [];

                  return {
                    id: messageId,
                    subject: getHeader(headers, "Subject"),
                    from: getHeader(headers, "From"),
                    date: getHeader(headers, "Date"),
                  };
                }),
            );

            return {
              emailAddress: profile.data.emailAddress,
              messagesTotal: profile.data.messagesTotal,
              threadsTotal: profile.data.threadsTotal,
              query,
              sampleMessages: sampleMessages.filter((value) => value !== null),
            };
          }),
      });
    }),
  );
}

export const layer = GmailReader.layer.pipe(
  Layer.provide(GmailReadConfig.layer),
);

export const program = Effect.gen(function* () {
  const gmail = yield* GmailReader;
  const output = yield* gmail.readMailbox();

  yield* Effect.sync(() => {
    console.log(JSON.stringify(output, null, 2));
  });
}).pipe(Effect.provide(layer));

runNodeMain(program);
