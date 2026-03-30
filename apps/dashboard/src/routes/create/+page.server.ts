import { getRuntimeFunctionMetadata } from "@ns-sentinel/runtime-functions";

export const load = async () => ({
  runtimeFunctions: getRuntimeFunctionMetadata(),
});
