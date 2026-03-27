import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { ConfigProvider, Data, Effect, Layer, ManagedRuntime } from "effect";
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

export const environmentConfigProvider = ConfigProvider.fromEnv();

export const withEnvConfig = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      environmentConfigProvider,
    ),
  );

export const makeNodeRuntime = <R, E>(layer: Layer.Layer<R, E>) =>
  ManagedRuntime.make(Layer.mergeAll(NodeServices.layer, layer));

export const runNodeMain = <A, E>(effect: Effect.Effect<A, E>) =>
  NodeRuntime.runMain(withEnvConfig(effect));

export const resolvePackageDir = (moduleUrl: string) =>
  fileURLToPath(new URL("..", moduleUrl));
