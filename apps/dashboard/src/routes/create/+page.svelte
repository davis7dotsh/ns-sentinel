<script lang="ts">
  import { goto } from "$app/navigation";

  let prompt = $state(
    "Create a page that highlights the latest YouTube videos and top X posts for the most recently synced channel.",
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
        throw new Error("The demo generator did not accept that prompt.");
      }

      const snapshot = (await response.json()) as {
        readonly runId: string;
        readonly slug: string;
      };

      await goto(`/gen/${snapshot.slug}?run=${snapshot.runId}`);
    } catch (cause) {
      errorMessage =
        cause instanceof Error
          ? cause.message
          : "Failed to start the generated page demo.";
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
        This hard-coded demo still follows the eventual flow: prompt in the
        shell, generation state on a destination route, then a sandboxed iframe
        once the result is ready.
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
  </div>
</section>
