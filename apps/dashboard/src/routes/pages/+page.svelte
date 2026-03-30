<script lang="ts">
  import { useQuery } from "convex-svelte";
  import { api } from "@ns-sentinel/convex/api";
  import { deletePageCommand } from "$lib/dashboard.remote";
  import { formatTimestamp } from "$lib/format";

  const pagesQuery = useQuery(api.pages.listPages, () => ({}));
  const pages = $derived(pagesQuery.data ?? []);

  let deletingId = $state<string | null>(null);
  let confirmingId = $state<string | null>(null);

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

  const deletePage = async (pageId: string) => {
    deletingId = pageId;

    try {
      await deletePageCommand(pageId);
    } finally {
      deletingId = null;
      confirmingId = null;
    }
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
        <div class="flex items-center gap-2 py-4">
          <a
            class="flex min-w-0 flex-1 items-center justify-between gap-4 transition hover:opacity-75"
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

          {#if confirmingId === genPage.id}
            <div class="flex shrink-0 items-center gap-1.5">
              <button
                class="rounded-full px-3 py-1 text-sm text-red-700 transition hover:bg-red-50"
                disabled={deletingId === genPage.id}
                onclick={() => deletePage(genPage.id)}
                type="button"
              >
                {deletingId === genPage.id ? "Deleting..." : "Confirm"}
              </button>
              <button
                class="rounded-full px-3 py-1 text-sm text-stone-500 transition hover:bg-stone-100"
                onclick={() => {
                  confirmingId = null;
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          {:else}
            <button
              aria-label="Delete page"
              class="shrink-0 rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
              onclick={() => {
                confirmingId = genPage.id;
              }}
              type="button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</section>
