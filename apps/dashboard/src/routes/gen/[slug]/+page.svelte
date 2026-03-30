<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { useQuery } from "convex-svelte";
  import { api } from "@ns-sentinel/convex/api";
  import type { Id } from "@ns-sentinel/convex/data-model";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let editPrompt = $state("");
  let errorMessage = $state<string | null>(null);
  let isEditorOpen = $state(false);
  let isSubmittingEdit = $state(false);
  let isRetrying = $state(false);

  const toPageVersionId = (value: string | null) =>
    value ? (value as Id<"pageVersions">) : undefined;

  const selectedVersionId = $derived(page.url.searchParams.get("version"));
  const pageViewQuery = useQuery(
    api.pages.getPageView,
    () => ({
      slug: data.slug,
      versionId: toPageVersionId(selectedVersionId),
    }),
    () => ({
      initialData: data.initialPageView,
      keepPreviousData: true,
    }),
  );

  const pageView = $derived(pageViewQuery.data ?? data.initialPageView);
  const selectedVersion = $derived(pageView.selectedVersion);
  const iframeTitle = $derived(pageView.page.title || "Generated preview");
  const iframeUrl = $derived(
    `/sandbox/${pageView.page.slug}?version=${selectedVersion.id}`,
  );
  const statusTone = $derived(
    selectedVersion.status === "error"
      ? "text-red-700"
      : selectedVersion.status === "ready"
        ? "text-emerald-700"
        : "text-amber-700",
  );
  const statusLabel = $derived(
    selectedVersion.status === "working"
      ? "Generating page"
      : selectedVersion.status === "ready"
        ? "Preview ready"
        : "Generation failed",
  );
  const canEdit = $derived(
    selectedVersion.status === "ready" || selectedVersion.status === "error",
  );

  const navigateToVersion = async (versionId: string) => {
    const nextUrl = new URL(page.url);

    nextUrl.searchParams.set("version", versionId);
    await goto(`${nextUrl.pathname}?${nextUrl.searchParams.toString()}`, {
      keepFocus: true,
      noScroll: true,
      replaceState: true,
    });
  };

  const submitEdit = async () => {
    const prompt = editPrompt.trim();

    if (prompt.length === 0 || isSubmittingEdit) {
      return;
    }

    isSubmittingEdit = true;
    errorMessage = null;

    try {
      const response = await fetch(
        `/api/generated-demo/apps/${pageView.page.slug}/edits`,
        {
          body: JSON.stringify({
            baseVersionId: selectedVersion.id,
            prompt,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to start the next generated version.");
      }

      const payload = (await response.json()) as {
        readonly slug: string;
        readonly versionId: string;
      };

      editPrompt = "";
      isEditorOpen = false;
      await goto(`/gen/${payload.slug}?version=${payload.versionId}`);
    } catch (cause) {
      errorMessage =
        cause instanceof Error
          ? cause.message
          : "Failed to start the next generated version.";
    } finally {
      isSubmittingEdit = false;
    }
  };

  const retryVersion = async () => {
    if (selectedVersion.status !== "error" || isRetrying) {
      return;
    }

    isRetrying = true;
    errorMessage = null;

    try {
      const response = await fetch(
        `/api/generated-demo/versions/${selectedVersion.id}/retry`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to retry this generated version.");
      }

      const payload = (await response.json()) as {
        readonly versionId: string;
      };

      await navigateToVersion(payload.versionId);
    } catch (cause) {
      errorMessage =
        cause instanceof Error
          ? cause.message
          : "Failed to retry this generated version.";
    } finally {
      isRetrying = false;
    }
  };

  const onVersionChange = async (event: Event) => {
    const target = event.currentTarget;

    if (!(target instanceof HTMLSelectElement)) {
      return;
    }

    await navigateToVersion(target.value);
  };
</script>

<svelte:head>
  <title>{iframeTitle}</title>
</svelte:head>

<section class="flex h-full flex-col">
  <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-3">
      <a class="text-sm text-stone-500 transition hover:text-stone-800" href="/"
        >&larr;</a
      >
      <div>
        <h1 class="text-lg font-semibold tracking-tight text-stone-950">
          {pageView.page.title}
        </h1>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <span class="text-sm {statusTone}">{statusLabel}</span>

      <label
        class="flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/80 px-3 py-1.5 text-sm backdrop-blur"
      >
        <span class="text-stone-500">v</span>
        <select
          class="bg-transparent font-medium text-stone-900 outline-none"
          onchange={onVersionChange}
          value={selectedVersion.id}
        >
          {#each pageView.versions as version (version.id)}
            <option value={version.id}>
              {version.versionNumber} &middot; {version.status}
            </option>
          {/each}
        </select>
      </label>
    </div>
  </div>

  {#if selectedVersion.status !== "ready"}
    <div class="flex flex-1 items-center justify-center">
      <div class="max-w-sm space-y-4 text-center">
        {#if selectedVersion.status === "working"}
          <div
            class="mx-auto h-10 w-10 animate-spin rounded-full border-[3px] border-stone-200 border-t-stone-700"
          ></div>
        {/if}

        <div class="space-y-1.5">
          <p class="text-base font-medium text-stone-900">{statusLabel}</p>
          <p class="text-sm leading-6 text-stone-500">
            {#if selectedVersion.status === "working"}
              Generating this version now. The preview will appear automatically
              once it's ready.
            {:else}
              {selectedVersion.errorMessage ??
                "Generation failed before page artifacts were stored."}
            {/if}
          </p>
        </div>

        {#if selectedVersion.status === "error"}
          <button
            class="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-medium text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
            disabled={isRetrying}
            onclick={retryVersion}
            type="button"
          >
            {isRetrying ? "Retrying..." : "Retry"}
          </button>
        {/if}
      </div>
    </div>
  {:else}
    <iframe
      class="block flex-1 rounded-2xl border border-stone-200/80 bg-white"
      src={iframeUrl}
      title={iframeTitle}
      style="min-height: calc(100vh - 10rem)"
    ></iframe>
  {/if}
</section>

<div class="fixed bottom-6 right-6 z-20 flex flex-col items-end gap-3">
  {#if isEditorOpen}
    <div
      class="w-[min(22rem,calc(100vw-2rem))] space-y-3 rounded-2xl border border-stone-200/80 bg-white/95 p-4 shadow-[0_16px_48px_rgba(28,25,23,0.12)] backdrop-blur"
    >
      <p class="text-sm font-medium text-stone-900">Edit this page</p>

      <textarea
        bind:value={editPrompt}
        class="min-h-28 w-full rounded-xl border border-stone-200/80 bg-stone-50/60 px-4 py-3 text-sm leading-6 text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
        placeholder="Tighten the layout, show larger cards..."
      ></textarea>

      {#if errorMessage}
        <p class="text-sm text-red-700">{errorMessage}</p>
      {/if}

      <div class="flex justify-between gap-3">
        <button
          class="rounded-full px-3 py-1.5 text-sm text-stone-500 transition hover:bg-stone-100 hover:text-stone-700"
          onclick={() => {
            isEditorOpen = false;
          }}
          type="button"
        >
          Cancel
        </button>
        <button
          class="rounded-full bg-stone-950 px-4 py-1.5 text-sm font-medium text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
          disabled={isSubmittingEdit || editPrompt.trim().length === 0}
          onclick={submitEdit}
          type="button"
        >
          {isSubmittingEdit ? "Regenerating..." : "Apply edit"}
        </button>
      </div>
    </div>
  {/if}

  <button
    aria-label="Edit generated page"
    class="flex h-12 w-12 items-center justify-center rounded-full bg-stone-950 shadow-[0_12px_32px_rgba(28,25,23,0.24)] transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
    disabled={!canEdit}
    onclick={() => {
      isEditorOpen = !isEditorOpen;
      errorMessage = null;
    }}
    type="button"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="text-stone-50"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  </button>
</div>
