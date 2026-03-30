import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    ignorePatterns: ["packages/convex/convex/_generated/**"],
  },
  fmt: {
    ignorePatterns: ["packages/convex/convex/_generated/**"],
  },
});
