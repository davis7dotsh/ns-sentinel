<script lang="ts">
  import { setupConvex } from "convex-svelte";

  const props = $props<{
    children: import("svelte").Snippet;
    convexUrl: string;
  }>();

  setupConvex(props.convexUrl);
</script>

{@render props.children()}
