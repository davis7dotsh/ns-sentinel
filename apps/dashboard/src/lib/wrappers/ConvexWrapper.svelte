<script lang="ts">
  import { untrack } from "svelte";
  import { setupConvex } from "convex-svelte";

  const props = $props<{
    children: import("svelte").Snippet;
    convexUrl: string;
  }>();

  setupConvex(untrack(() => props.convexUrl));
</script>

{@render props.children()}
