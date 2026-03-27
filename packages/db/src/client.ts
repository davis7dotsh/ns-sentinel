import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/ns_sentinel_dev";

const queryClient = postgres(databaseUrl, {
  max: 1,
});

export const db = drizzle(queryClient, { schema });
export { queryClient, schema };
