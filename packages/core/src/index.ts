import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { config as loadDotenv } from "dotenv";
import { ConfigProvider, Data, Effect, Layer, ManagedRuntime } from "effect";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export class SentinelError extends Data.TaggedError("SentinelError")<{
  readonly module: string;
  readonly operation: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export const createSentinelError = (options: {
  module: string;
  operation: string;
  message: string;
  cause?: unknown;
}) => new SentinelError(options);

let workspaceEnvLoaded = false;

const isWorkspaceRoot = (directoryPath: string) => {
  const packageJsonPath = path.join(directoryPath, "package.json");

  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

    return Array.isArray(packageJson.workspaces);
  } catch {
    return false;
  }
};

export const findWorkspaceRoot = (startDirectory = process.cwd()) => {
  let currentDirectory = path.resolve(startDirectory);

  while (true) {
    if (isWorkspaceRoot(currentDirectory)) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return undefined;
    }

    currentDirectory = parentDirectory;
  }
};

export const loadWorkspaceEnv = (startDirectory = process.cwd()) => {
  if (workspaceEnvLoaded) {
    return;
  }

  const workspaceRoot = findWorkspaceRoot(startDirectory);

  if (!workspaceRoot) {
    return;
  }

  const envFilePaths = [
    path.join(workspaceRoot, ".env"),
    path.join(workspaceRoot, ".env.local"),
  ];

  for (const envFilePath of envFilePaths) {
    if (!existsSync(envFilePath)) {
      continue;
    }

    loadDotenv({
      path: envFilePath,
      override: false,
    });
  }

  workspaceEnvLoaded = true;
};

export const environmentConfigProvider = () => ConfigProvider.fromEnv();

export const withEnvConfig = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.sync(() => loadWorkspaceEnv()).pipe(
    Effect.andThen(Effect.sync(() => environmentConfigProvider())),
    Effect.flatMap((configProvider) =>
      effect.pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, configProvider),
      ),
    ),
  );

export const makeNodeRuntime = <R, E>(layer: Layer.Layer<R, E>) =>
  ManagedRuntime.make(Layer.mergeAll(NodeServices.layer, layer));

export const runNodeMain = <A, E>(effect: Effect.Effect<A, E>) =>
  NodeRuntime.runMain(withEnvConfig(effect));

export const resolvePackageDir = (moduleUrl: string) =>
  fileURLToPath(new URL("..", moduleUrl));

export const isDirectExecution = (moduleUrl: string) => {
  const entrypoint = process.argv[1];

  if (!entrypoint) {
    return false;
  }

  return path.resolve(entrypoint) === path.resolve(fileURLToPath(moduleUrl));
};
