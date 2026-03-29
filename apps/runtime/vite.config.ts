import { loadWorkspaceEnv } from "@ns-sentinel/core";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

loadWorkspaceEnv(import.meta.dirname);

export default defineConfig({
  plugins: [sveltekit()],
});
