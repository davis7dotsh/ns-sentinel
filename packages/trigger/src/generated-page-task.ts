import { task } from "@trigger.dev/sdk";

export const generateGeneratedPageVersionTask = task({
  id: "generated-page.generate-version",
  maxDuration: 3_600,
  run: async (_payload: { versionId: string }) => {
    throw new Error(
      "Generated page generation is being migrated to Convex-backed state and the pi SDK agent.",
    );
  },
});
