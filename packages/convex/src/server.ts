import { randomUUID } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import type {
  ArgsAndOptions,
  DefaultFunctionArgs,
  FunctionReference,
  OptionalRestArgs,
} from "convex/server";
import { getFunctionName } from "convex/server";
import { getRequiredConvexPrivateApiKey } from "./private-auth";

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

const createBaseConvexServerClient = (client: ConvexHttpClient, mode: "public" | "private") => ({
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
        ...([mode === "private" ? withApiKey(args) : args] as unknown as OptionalRestArgs<
          typeof func
        >),
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
    func: FunctionReference<"mutation", "public", Args, Result, ComponentPath>,
    args: Omit<Args, "apiKey">,
  ) => {
    try {
      return await client.mutation(
        func,
        ...([mode === "private" ? withApiKey(args) : args] as unknown as ArgsAndOptions<
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

  query: async <Args extends DefaultFunctionArgs, Result, ComponentPath extends string | undefined>(
    func: FunctionReference<"query", "public", Args, Result, ComponentPath>,
    args: Omit<Args, "apiKey">,
  ) => {
    try {
      return await client.query(
        func,
        ...([mode === "private" ? withApiKey(args) : args] as unknown as OptionalRestArgs<
          typeof func
        >),
      );
    } catch (cause) {
      throw createConvexServerError({
        cause,
        func,
        operation: "query",
      });
    }
  },
});

const withApiKey = <Args extends DefaultFunctionArgs>(args: Omit<Args, "apiKey">) =>
  ({
    ...args,
    apiKey: getRequiredConvexPrivateApiKey(),
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
    message: input.cause instanceof Error ? input.cause.message : String(input.cause),
    operation: input.operation,
    traceId: randomUUID(),
  });

export const createConvexServerClient = (convexUrl: string) => {
  const client = new ConvexHttpClient(convexUrl);

  return createBaseConvexServerClient(client, "private");
};

export const createConvexPublicServerClient = (convexUrl: string) =>
  createBaseConvexServerClient(new ConvexHttpClient(convexUrl), "public");
