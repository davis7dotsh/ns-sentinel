import { defineConfig } from "drizzle-kit";
import { loadWorkspaceEnv } from "@ns-sentinel/core";

loadWorkspaceEnv();

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/ns_sentinel_dev";

export default defineConfig({
  out: "./packages/db/drizzle",
  schema: "./packages/db/src/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
