<script lang="ts">
  import { useQuery } from "convex-svelte";
  import { api } from "@ns-sentinel/convex/api";
  import { formatTimestamp } from "$lib/format";

  const pagesQuery = useQuery(api.pages.listPages, () => ({}));
  const pages = $derived(pagesQuery.data ?? []);

  const statusColor = (status: string | null) => {
    if (status === "ready") return "text-emerald-700";
    if (status === "error") return "text-red-700";
    if (status === "working") return "text-amber-700";
    return "text-stone-400";
  };

  const statusLabel = (status: string | null) => {
    if (status === "ready") return "Ready";
    if (status === "error") return "Error";
    if (status === "working") return "Working";
    return "—";
  };
</script>

<svelte:head>
  <title>Generated Pages</title>
</svelte:head>

<section class="space-y-6">
  <div class="flex items-end justify-between gap-4">
    <div class="space-y-2">
      <p class="text-xs uppercase tracking-[0.28em] text-stone-500">Library</p>
      <h1 class="text-2xl font-semibold tracking-tight text-stone-950">
        Generated pages
      </h1>
    </div>

    <a
      class="rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-stone-50 transition hover:bg-stone-800"
      href="/create"
    >
      New page
    </a>
  </div>

  {#if pagesQuery.isLoading}
    <p class="text-sm text-stone-500">Loading pages...</p>
  {:else if pages.length === 0}
    <div
      class="flex flex-col items-center justify-center gap-3 py-20 text-center"
    >
      <p class="text-sm text-stone-500">No generated pages yet.</p>
      <a
        class="text-sm text-stone-500 transition hover:text-stone-800"
        href="/create"
      >
        Create your first page &rarr;
      </a>
    </div>
  {:else}
    <div class="divide-y divide-stone-200/80 border-t border-stone-200/80">
      {#each pages as genPage (genPage.id)}
        <a
          class="flex items-center justify-between gap-4 py-4 transition hover:bg-stone-50/50"
          href={`/gen/${genPage.slug}`}
        >
          <div class="min-w-0 space-y-0.5">
            <h2 class="truncate text-base font-medium text-stone-950">
              {genPage.title}
            </h2>
            <p class="text-sm text-stone-500">
              /{genPage.slug}
              <span class="text-stone-400">&middot;</span>
              v{genPage.latestVersionNumber}
            </p>
          </div>

          <div class="flex shrink-0 items-center gap-4 text-sm">
            <span class={statusColor(genPage.currentVersionStatus)}>
              {statusLabel(genPage.currentVersionStatus)}
            </span>
            <span class="text-stone-500">
              {formatTimestamp(genPage.updatedAt)}
            </span>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</section>
