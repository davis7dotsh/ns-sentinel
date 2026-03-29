import { randomUUID } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import type {
  ArgsAndOptions,
  DefaultFunctionArgs,
  FunctionReference,
  OptionalRestArgs,
} from "convex/server";
import { getFunctionName } from "convex/server";
import { getRequiredConvexPrivateBridgeKey } from "./private-auth";

export class ConvexServerError extends Error {
  readonly cause?: unknown;
  readonly functionName: string;
  readonly operation: "query" | "mutation" | "action";
  readonly traceId: string;

  constructor(input: {
    readonly cause?: unknown;
    readonly functionName: string;
    readonly message: string;
    readonly operation: "query" | "mutation" | "action";
    readonly traceId: string;
  }) {
    super(input.message);

    this.name = "ConvexServerError";
    this.cause = input.cause;
    this.functionName = input.functionName;
    this.operation = input.operation;
    this.traceId = input.traceId;
  }
}

const withApiKey = <Args extends DefaultFunctionArgs>(
  args: Omit<Args, "apiKey">,
) =>
  ({
    ...args,
    apiKey: getRequiredConvexPrivateBridgeKey(),
  }) as unknown as Args;

const createConvexServerError = <
  Kind extends "query" | "mutation" | "action",
  Args extends DefaultFunctionArgs,
  Result,
  ComponentPath extends string | undefined,
>(input: {
  cause: unknown;
  func: FunctionReference<Kind, "public", Args, Result, ComponentPath>;
  operation: Kind;
}) =>
  new ConvexServerError({
    cause: input.cause,
    functionName: getFunctionName(input.func),
    message:
      input.cause instanceof Error ? input.cause.message : String(input.cause),
    operation: input.operation,
    traceId: randomUUID(),
  });

export const createConvexServerClient = (convexUrl: string) => {
  const client = new ConvexHttpClient(convexUrl);

  return {
    action: async <
      Args extends DefaultFunctionArgs,
      Result,
      ComponentPath extends string | undefined,
    >(
      func: FunctionReference<"action", "public", Args, Result, ComponentPath>,
      args: Omit<Args, "apiKey">,
    ) => {
      try {
        return await client.action(
          func,
          ...([withApiKey(args)] as unknown as OptionalRestArgs<typeof func>),
        );
      } catch (cause) {
        throw createConvexServerError({
          cause,
          func,
          operation: "action",
        });
      }
    },

    mutation: async <
      Args extends DefaultFunctionArgs,
      Result,
      ComponentPath extends string | undefined,
    >(
      func: FunctionReference<
        "mutation",
        "public",
        Args,
        Result,
        ComponentPath
      >,
      args: Omit<Args, "apiKey">,
    ) => {
      try {
        return await client.mutation(
          func,
          ...([withApiKey(args)] as unknown as ArgsAndOptions<
            typeof func,
            { skipQueue: boolean }
          >),
        );
      } catch (cause) {
        throw createConvexServerError({
          cause,
          func,
          operation: "mutation",
        });
      }
    },

    query: async <
      Args extends DefaultFunctionArgs,
      Result,
      ComponentPath extends string | undefined,
    >(
      func: FunctionReference<"query", "public", Args, Result, ComponentPath>,
      args: Omit<Args, "apiKey">,
    ) => {
      try {
        return await client.query(
          func,
          ...([withApiKey(args)] as unknown as OptionalRestArgs<typeof func>),
        );
      } catch (cause) {
        throw createConvexServerError({
          cause,
          func,
          operation: "query",
        });
      }
    },
  };
};
