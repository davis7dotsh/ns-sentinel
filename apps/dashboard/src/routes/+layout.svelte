<script lang="ts">
  import { page } from "$app/state";
  import ConvexWrapper from "$lib/wrappers/ConvexWrapper.svelte";
  import "../app.css";

  let { children, data } = $props<{
    children: import("svelte").Snippet;
    data: {
      readonly convexUrl: string;
    };
  }>();

  const pathname = $derived(page.url.pathname);
  const isGeneratedRoute = $derived(pathname.startsWith("/gen/"));
  const isCreateRoute = $derived(pathname === "/create");
  const isPagesRoute = $derived(pathname === "/pages");
  const showFab = $derived(
    !isGeneratedRoute && !isCreateRoute && !isPagesRoute,
  );
  const shellClassName = $derived(
    isGeneratedRoute
      ? "mx-auto flex min-h-screen max-w-6xl flex-col px-5 pt-8 sm:px-8"
      : "mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8",
  );
  const contentClassName = $derived(isGeneratedRoute ? "flex-1" : "");
</script>

<ConvexWrapper convexUrl={data.convexUrl}>
  <div class={shellClassName}>
    <header
      class="mb-8 flex items-baseline justify-between border-b border-stone-300/60 pb-3"
    >
      <div class="flex items-baseline gap-6">
        <a class="text-sm uppercase tracking-[0.28em] text-stone-600" href="/">
          Sentinel
        </a>
        <nav class="flex items-baseline gap-4">
          <a
            class="text-sm transition {pathname === '/' ||
            pathname.startsWith('/channel')
              ? 'text-stone-900 font-medium'
              : 'text-stone-500 hover:text-stone-800'}"
            href="/"
          >
            Channels
          </a>
          <a
            class="text-sm transition {pathname === '/pages' ||
            pathname.startsWith('/gen/') ||
            pathname === '/create'
              ? 'text-stone-900 font-medium'
              : 'text-stone-500 hover:text-stone-800'}"
            href="/pages"
          >
            Pages
          </a>
        </nav>
      </div>
    </header>

    <div class={contentClassName}>
      {@render children?.()}
    </div>
  </div>

  {#if showFab}
    <a
      aria-label="Create generated page"
      class="fixed bottom-6 right-6 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-stone-950 text-2xl leading-none text-white no-underline shadow-[0_12px_32px_rgba(28,25,23,0.24)] transition hover:bg-stone-800"
      href="/create"
    >
      <span class="font-medium text-white">+</span>
    </a>
  {/if}
</ConvexWrapper>
