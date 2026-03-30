<script lang="ts">
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let prompt = $state(
    "Create a page that highlights the latest YouTube videos and top comments for the most recently synced channel.",
  );
  let errorMessage = $state<string | null>(null);
  let isSubmitting = $state(false);

  const canSubmit = $derived(prompt.trim().length > 0 && !isSubmitting);

  const submitPrompt = async () => {
    if (!canSubmit) {
      return;
    }

    isSubmitting = true;
    errorMessage = null;

    try {
      const response = await fetch("/api/generated-demo/runs", {
        body: JSON.stringify({ prompt }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("The generator did not accept that prompt.");
      }

      const snapshot = (await response.json()) as {
        readonly slug: string;
        readonly versionId: string;
      };

      await goto(`/gen/${snapshot.slug}?version=${snapshot.versionId}`);
    } catch (cause) {
      errorMessage =
        cause instanceof Error
          ? cause.message
          : "Failed to start the generated page.";
    } finally {
      isSubmitting = false;
    }
  };
</script>

<svelte:head>
  <title>Create Generated Page</title>
</svelte:head>

<section class="mx-auto flex min-h-[72vh] max-w-2xl items-center">
  <div class="w-full space-y-6 py-4">
    <div class="space-y-2">
      <p class="text-xs uppercase tracking-[0.28em] text-stone-500">New page</p>
      <h1 class="text-3xl font-semibold tracking-tight text-stone-950">
        Describe the page you want to build.
      </h1>
      <p class="max-w-xl text-sm leading-6 text-stone-500">
        Generated pages can query data through the runtime functions listed
        below. You'll see a live preview once generation finishes.
      </p>
    </div>

    <div class="space-y-4">
      <textarea
        bind:value={prompt}
        class="min-h-44 w-full rounded-2xl border border-stone-300/80 bg-white/60 px-5 py-4 text-base leading-7 text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
        placeholder="Create a page that..."
      ></textarea>

      {#if errorMessage}
        <p class="text-sm text-red-700">{errorMessage}</p>
      {/if}

      <div class="flex items-center justify-between gap-4">
        <a
          class="text-sm text-stone-500 transition hover:text-stone-800"
          href="/"
        >
          &larr; Dashboard
        </a>

        <button
          class="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-medium text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
          disabled={!canSubmit}
          onclick={submitPrompt}
          type="button"
        >
          {isSubmitting ? "Launching..." : "Generate"}
        </button>
      </div>
    </div>

    <details class="group">
      <summary
        class="flex cursor-pointer list-none items-center gap-2 text-sm text-stone-500 transition hover:text-stone-700"
      >
        <span
          class="inline-block transition group-open:rotate-90"
          aria-hidden="true">&rsaquo;</span
        >
        Runtime functions ({data.runtimeFunctions.length})
      </summary>

      <div class="mt-4 space-y-2">
        {#each data.runtimeFunctions as runtimeFunction (runtimeFunction.name)}
          <details
            class="group/fn rounded-xl border border-stone-200/80 bg-white/60"
          >
            <summary
              class="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3"
            >
              <div class="min-w-0">
                <p class="text-sm font-medium text-stone-900">
                  {runtimeFunction.name}
                </p>
                <p class="truncate text-sm text-stone-500">
                  {runtimeFunction.description}
                </p>
              </div>
              <span
                class="shrink-0 text-xs text-stone-400 transition group-open/fn:hidden"
              >
                {runtimeFunction.args.length} arg{runtimeFunction.args
                  .length === 1
                  ? ""
                  : "s"}
              </span>
            </summary>

            <div class="space-y-2 border-t border-stone-200/80 px-4 py-3">
              {#if runtimeFunction.args.length === 0}
                <p class="text-sm text-stone-500">No arguments.</p>
              {:else}
                {#each runtimeFunction.args as arg (arg.name)}
                  <div
                    class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
                  >
                    <code class="font-medium text-stone-900">{arg.name}</code>
                    <span class="text-xs text-stone-400">{arg.type}</span>
                    <span class="text-xs text-stone-400">
                      {arg.required
                        ? "required"
                        : "optional"}{#if arg.defaultValue}
                        &middot; default {arg.defaultValue}{/if}
                    </span>
                    {#if arg.description}
                      <p class="w-full text-stone-500">{arg.description}</p>
                    {/if}
                  </div>
                {/each}
              {/if}
            </div>
          </details>
        {/each}
      </div>
    </details>
  </div>
</section>
