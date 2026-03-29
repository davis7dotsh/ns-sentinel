import { z } from "zod";

export const GeneratedPageArtifactsSchema = z.object({
  css: z.string(),
  endpoint: z.string().min(1),
  html: z.string().min(1),
  js: z.string().min(1),
  title: z.string().min(1).max(120),
});

export type GeneratedPageArtifacts = z.infer<
  typeof GeneratedPageArtifactsSchema
>;
