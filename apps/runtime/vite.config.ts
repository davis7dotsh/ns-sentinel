import { findWorkspaceRoot, loadWorkspaceEnv } from "@ns-sentinel/core";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

loadWorkspaceEnv(import.meta.dirname);
const workspaceRoot = findWorkspaceRoot(import.meta.dirname) ?? import.meta.dirname;

export default defineConfig({
  envDir: workspaceRoot,
  plugins: [sveltekit()],
});
