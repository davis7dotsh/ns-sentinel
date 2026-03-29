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

<section class="relative h-full">
  <div class="pointer-events-none absolute right-0 top-0 z-10">
    <div
      class="rounded-full border border-stone-300/80 bg-white/85 px-4 py-2 text-sm shadow-[0_12px_30px_rgba(28,25,23,0.08)] backdrop-blur"
    >
      <span class={statusTone}>{statusLabel}</span>
    </div>
  </div>

  <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
    <div class="space-y-1">
      <p class="text-xs uppercase tracking-[0.24em] text-stone-500">
        Generated Page
      </p>
      <h1 class="text-2xl font-semibold tracking-tight text-stone-950">
        {pageView.page.title}
      </h1>
      <p class="text-sm text-stone-600">
        Slug: <span class="font-medium text-stone-900"
          >{pageView.page.slug}</span
        >
      </p>
    </div>

    <label
      class="flex items-center gap-3 rounded-full border border-stone-300/80 bg-white/85 px-4 py-2 text-sm text-stone-700 shadow-[0_12px_30px_rgba(28,25,23,0.06)] backdrop-blur"
    >
      <span class="font-medium text-stone-600">Version</span>
      <select
        class="bg-transparent font-medium text-stone-900 outline-none"
        onchange={onVersionChange}
        value={selectedVersion.id}
      >
        {#each pageView.versions as version (version.id)}
          <option value={version.id}>
            v{version.versionNumber} · {version.status}
          </option>
        {/each}
      </select>
    </label>
  </div>

  {#if selectedVersion.status !== "ready"}
    <section
      class="flex h-full min-h-[calc(100vh-14rem)] items-center justify-center"
    >
      <div class="max-w-md space-y-4 text-center">
        {#if selectedVersion.status === "working"}
          <div
            class="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-stone-300 border-t-stone-800"
          ></div>
        {/if}

        <div class="space-y-2">
          <p class="text-lg font-medium text-stone-900">{statusLabel}</p>
          <p class="text-sm leading-6 text-stone-600">
            {#if selectedVersion.status === "working"}
              Trigger is generating this version now. Convex will push the ready
              state here automatically as soon as the artifacts land.
            {:else}
              {selectedVersion.errorMessage ??
                "Generation failed before the page artifacts were stored."}
            {/if}
          </p>
        </div>

        {#if selectedVersion.status === "error"}
          <button
            class="rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
            disabled={isRetrying}
            onclick={retryVersion}
            type="button"
          >
            {isRetrying ? "Retrying..." : "Retry"}
          </button>
        {/if}
      </div>
    </section>
  {:else}
    <iframe
      class="block h-[calc(100vh-14rem)] w-full rounded-[1.75rem] border border-stone-300/70 bg-transparent shadow-[0_30px_80px_rgba(28,25,23,0.12)]"
      src={iframeUrl}
      title={iframeTitle}
    ></iframe>
  {/if}
</section>

<div class="fixed bottom-6 right-6 z-20 flex flex-col items-end gap-3">
  {#if isEditorOpen}
    <div
      class="w-[min(24rem,calc(100vw-2rem))] space-y-3 rounded-[1.6rem] border border-stone-300/80 bg-white/92 p-4 shadow-[0_24px_60px_rgba(28,25,23,0.14)] backdrop-blur"
    >
      <div class="space-y-1">
        <p class="text-sm font-medium text-stone-900">Edit this version</p>
        <p class="text-sm leading-6 text-stone-600">
          The next generation uses the exact selected version as its editing
          context and creates a fresh historical version.
        </p>
      </div>

      <textarea
        bind:value={editPrompt}
        class="min-h-32 w-full rounded-[1.25rem] border border-stone-300/80 bg-stone-50/80 px-4 py-3 text-sm leading-6 text-stone-900 outline-none transition focus:border-stone-500 focus:bg-white"
        placeholder="Tighten the layout, add a stronger summary, show larger video cards..."
      ></textarea>

      {#if errorMessage}
        <p class="text-sm text-red-700">{errorMessage}</p>
      {/if}

      <div class="flex justify-between gap-3">
        <button
          class="rounded-full px-4 py-2 text-sm text-stone-600 transition hover:bg-stone-100"
          onclick={() => {
            isEditorOpen = false;
          }}
          type="button"
        >
          Close
        </button>
        <button
          class="rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
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
    class="flex h-14 w-14 items-center justify-center rounded-full bg-stone-950 text-lg font-semibold text-stone-50 shadow-[0_18px_40px_rgba(28,25,23,0.28)] transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
    disabled={!canEdit}
    onclick={() => {
      isEditorOpen = !isEditorOpen;
      errorMessage = null;
    }}
    type="button"
  >
    AI
  </button>
</div>
