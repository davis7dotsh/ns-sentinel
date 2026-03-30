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

<section class="mx-auto flex min-h-[72vh] max-w-3xl items-center">
  <div
    class="w-full space-y-8 rounded-[2rem] border border-stone-300/70 bg-white/70 p-8 shadow-[0_24px_60px_rgba(28,25,23,0.08)] backdrop-blur sm:p-10"
  >
    <div class="space-y-3">
      <p class="text-xs uppercase tracking-[0.28em] text-stone-500">
        Generated pages
      </p>
      <h1 class="text-4xl font-semibold tracking-tight text-stone-950">
        Describe the page you want to exist.
      </h1>
      <p class="max-w-2xl text-sm leading-6 text-stone-600">
        This creates a Convex-backed page record, kicks off a Trigger workflow,
        and streams the final iframe version back into the dashboard once the
        generated artifacts are ready. Generated pages can only query data
        through the runtime functions listed below.
      </p>
    </div>

    <div class="space-y-4">
      <label class="block space-y-2">
        <span class="text-sm font-medium text-stone-700">Prompt</span>
        <textarea
          bind:value={prompt}
          class="min-h-48 w-full rounded-[1.5rem] border border-stone-300/80 bg-stone-50/80 px-5 py-4 text-base leading-7 text-stone-900 outline-none transition focus:border-stone-500 focus:bg-white"
          placeholder="Create a page that..."
        ></textarea>
      </label>

      {#if errorMessage}
        <p class="text-sm text-red-700">{errorMessage}</p>
      {/if}

      <div class="flex items-center justify-between gap-4">
        <a
          class="text-sm text-stone-500 underline decoration-stone-300 underline-offset-4 hover:decoration-stone-700"
          href="/"
        >
          Back to dashboard
        </a>

        <button
          class="rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
          disabled={!canSubmit}
          onclick={submitPrompt}
          type="button"
        >
          {isSubmitting ? "Launching..." : "Generate"}
        </button>
      </div>
    </div>

    <section
      class="space-y-4 rounded-[1.5rem] border border-stone-300/70 bg-stone-50/75 p-5"
    >
      <div class="space-y-2">
        <p class="text-sm font-medium text-stone-900">
          Available runtime functions
        </p>
        <p class="text-sm leading-6 text-stone-600">
          The model can only build generated endpoints around these functions,
          so this is the clearest picture of what a custom page can and cannot
          load under the hood.
        </p>
      </div>

      <div class="space-y-3">
        {#each data.runtimeFunctions as runtimeFunction (runtimeFunction.name)}
          <details
            class="rounded-[1.25rem] border border-stone-300/70 bg-white/80 p-4"
          >
            <summary
              class="flex cursor-pointer list-none items-center justify-between gap-4"
            >
              <div class="space-y-1">
                <p class="text-sm font-medium text-stone-900">
                  {runtimeFunction.name}
                </p>
                <p class="text-sm leading-6 text-stone-600">
                  {runtimeFunction.description}
                </p>
              </div>
              <span class="text-xs uppercase tracking-[0.18em] text-stone-500">
                Advanced fields
              </span>
            </summary>

            <div class="mt-4 space-y-3 border-t border-stone-200 pt-4">
              {#if runtimeFunction.args.length === 0}
                <p class="text-sm text-stone-600">
                  This function does not take any arguments.
                </p>
              {:else}
                {#each runtimeFunction.args as arg (arg.name)}
                  <div class="rounded-2xl bg-stone-50 px-4 py-3">
                    <div class="flex flex-wrap items-center gap-2">
                      <code class="text-sm font-medium text-stone-900"
                        >{arg.name}</code
                      >
                      <span
                        class="text-xs uppercase tracking-[0.16em] text-stone-500"
                      >
                        {arg.type}
                      </span>
                      <span
                        class="text-xs uppercase tracking-[0.16em] text-stone-500"
                      >
                        {arg.required ? "Required" : "Optional"}
                      </span>
                      {#if arg.defaultValue}
                        <span class="text-xs text-stone-500">
                          Default: {arg.defaultValue}
                        </span>
                      {/if}
                    </div>
                    <p class="mt-2 text-sm leading-6 text-stone-600">
                      {arg.description}
                    </p>
                  </div>
                {/each}
              {/if}
            </div>
          </details>
        {/each}
      </div>
    </section>
  </div>
</section>
