<script lang="ts">
  import { page } from "$app/state";
  import "../app.css";

  let { children } = $props();

  const isGeneratedRoute = $derived(page.url.pathname.startsWith("/gen/"));
  const isCreateRoute = $derived(page.url.pathname === "/create");
  const shellClassName = $derived(
    isGeneratedRoute
      ? "mx-auto flex min-h-screen max-w-6xl flex-col px-5 pt-8 sm:px-8"
      : "mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8",
  );
  const contentClassName = $derived(isGeneratedRoute ? "flex-1" : "");
</script>

<div class={shellClassName}>
  <header
    class="mb-10 flex items-baseline justify-between border-b border-stone-300/80 pb-4"
  >
    <a class="text-sm uppercase tracking-[0.28em] text-stone-600" href="/">
      Sentinel
    </a>
    <p class="text-sm text-stone-500">dashboard</p>
  </header>

  <div class={contentClassName}>
    {@render children?.()}
  </div>
</div>

{#if !isGeneratedRoute && !isCreateRoute}
  <a
    aria-label="Create generated page"
    class="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-stone-950 text-3xl leading-none text-stone-50 shadow-[0_18px_40px_rgba(28,25,23,0.28)] transition hover:bg-stone-800"
    href="/create"
  >
    +
  </a>
{/if}
