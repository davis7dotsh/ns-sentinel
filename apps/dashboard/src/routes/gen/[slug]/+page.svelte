<script lang="ts">
  type DemoSnapshot = {
    readonly iframeUrl: string;
    readonly prompt: string;
    readonly revision: number;
    readonly runId: string;
    readonly slug: string;
    readonly status: "queued" | "generating" | "ready" | "failed";
    readonly statusLabel: string;
    readonly title: string;
  };

  let { data } = $props<{
    data: {
      readonly snapshot: DemoSnapshot;
    };
  }>();

  let editPrompt = $state("");
  let errorMessage = $state<string | null>(null);
  let isEditorOpen = $state(false);
  let isSubmittingEdit = $state(false);
  let streamedSnapshot = $state.raw<DemoSnapshot | null>(null);

  const snapshot = $derived(streamedSnapshot ?? data.snapshot);
  const iframeTitle = $derived(snapshot.title || "Generated preview");
  const statusTone = $derived(
    snapshot.status === "failed"
      ? "text-red-700"
      : snapshot.status === "ready"
        ? "text-emerald-700"
        : "text-amber-700",
  );

  $effect(() => {
    if (snapshot.status === "ready" || snapshot.status === "failed") {
      return;
    }

    const source = new EventSource(
      `/api/generated-demo/runs/${snapshot.runId}/events`,
    );

    source.onmessage = (event) => {
      streamedSnapshot = JSON.parse(event.data) as DemoSnapshot;
    };

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  });

  const submitEdit = async () => {
    const prompt = editPrompt.trim();

    if (prompt.length === 0 || isSubmittingEdit) {
      return;
    }

    isSubmittingEdit = true;
    errorMessage = null;

    try {
      const response = await fetch(
        `/api/generated-demo/apps/${snapshot.slug}/edits`,
        {
          body: JSON.stringify({ prompt }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to start the next generated revision.");
      }

      streamedSnapshot = (await response.json()) as DemoSnapshot;
      editPrompt = "";
      isEditorOpen = false;
    } catch (cause) {
      errorMessage =
        cause instanceof Error
          ? cause.message
          : "Failed to start the next generated revision.";
    } finally {
      isSubmittingEdit = false;
    }
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
      <span class={statusTone}>{snapshot.statusLabel}</span>
    </div>
  </div>
  {#if snapshot.status !== "ready"}
    <section
      class="flex h-full min-h-[calc(100vh-10rem)] items-center justify-center"
    >
      <div class="max-w-md space-y-4 text-center">
        <div
          class="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-stone-300 border-t-stone-800"
        ></div>
        <div class="space-y-2">
          <p class="text-lg font-medium text-stone-900">
            {snapshot.statusLabel}
          </p>
          <p class="text-sm leading-6 text-stone-600">
            We already navigated to the final route. Once the demo runtime marks
            this revision ready, the iframe preview will replace this state in
            place.
          </p>
        </div>
      </div>
    </section>
  {:else}
    <iframe
      class="block h-[calc(100vh-10rem)] w-full bg-transparent"
      src={snapshot.iframeUrl}
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
        <p class="text-sm font-medium text-stone-900">Edit this page</p>
        <p class="text-sm leading-6 text-stone-600">
          This still regenerates the same hard-coded demo, but it creates a new
          revision and reruns the realtime flow.
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
    class="flex h-14 w-14 items-center justify-center rounded-full bg-stone-950 text-lg font-semibold text-stone-50 shadow-[0_18px_40px_rgba(28,25,23,0.28)] transition hover:bg-stone-800"
    onclick={() => {
      isEditorOpen = !isEditorOpen;
    }}
    type="button"
  >
    AI
  </button>
</div>
