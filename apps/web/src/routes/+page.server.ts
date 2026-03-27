import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { error } from "@sveltejs/kit";
import { Data, Effect } from "effect";
import type { PageServerLoad } from "./$types";

class WebLoadError extends Data.TaggedError("WebLoadError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

const rootDir = resolve(import.meta.dirname, "../../..");

const readJson = <T>(path: string) =>
  Effect.tryPromise({
    try: async () => JSON.parse(await readFile(path, "utf8")) as T,
    catch: (cause) =>
      new WebLoadError({
        message: `Failed to read ${path}.`,
        cause,
      }),
  });

const packages = [
  {
    name: "@ns-sentinel/core",
    path: "packages/core/package.json",
    description:
      "Shared runtime helpers, env config wiring, and tagged app errors.",
  },
  {
    name: "@ns-sentinel/db",
    path: "packages/db/package.json",
    description:
      "Scoped database layer with typed config and managed shutdown.",
  },
  {
    name: "@ns-sentinel/gmail-read",
    path: "packages/gmail-read/package.json",
    description: "Gmail reader rebuilt as config + service + program.",
  },
  {
    name: "@ns-sentinel/notion-read",
    path: "packages/notion-read/package.json",
    description: "Notion reader rebuilt as config + service + program.",
  },
  {
    name: "@ns-sentinel/slack-read",
    path: "packages/slack-read/package.json",
    description: "Slack reader rebuilt as config + service + program.",
  },
  {
    name: "@ns-sentinel/x-read",
    path: "packages/x-read/package.json",
    description: "X reader rebuilt as config + service + program.",
  },
  {
    name: "@ns-sentinel/youtube-read",
    path: "packages/youtube-read/package.json",
    description: "YouTube reader rebuilt as config + service + program.",
  },
  {
    name: "web",
    path: "apps/web/package.json",
    description:
      "SvelteKit app now loads project status through Effect on the server.",
  },
] as const;

export const load = (async () => {
  const program = Effect.gen(function* () {
    const rootPackage = yield* readJson<{
      packageManager: string;
      scripts?: Record<string, string>;
    }>(resolve(rootDir, "package.json"));

    const modules = yield* Effect.forEach(packages, (pkg) =>
      Effect.gen(function* () {
        const manifest = yield* readJson<{
          scripts?: Record<string, string>;
          dependencies?: Record<string, string>;
        }>(resolve(rootDir, pkg.path));

        return {
          name: pkg.name,
          description: pkg.description,
          effectVersion: manifest.dependencies?.effect ?? null,
          nodePlatformVersion:
            manifest.dependencies?.["@effect/platform-node"] ?? null,
          checkCommand: manifest.scripts?.check ?? null,
          startCommand: manifest.scripts?.start ?? null,
        };
      }),
    );

    return {
      packageManager: rootPackage.packageManager,
      workspaceCheck: rootPackage.scripts?.check ?? null,
      modules,
    };
  });

  const result = await Effect.runPromise(program).catch((cause) => {
    console.error(cause);
    throw error(500, "Failed to load the Effect migration status.");
  });

  return result;
}) satisfies PageServerLoad;
