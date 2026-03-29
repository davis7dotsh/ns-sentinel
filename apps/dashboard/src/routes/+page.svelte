<script lang="ts">
  import Avatar from "$lib/components/Avatar.svelte";
  import { getChannels } from "$lib/dashboard.remote";
  import { formatCount, formatDate } from "$lib/format";

  const channels = getChannels();
</script>

<svelte:head>
  <title>Sentinel Dashboard</title>
</svelte:head>

<section class="space-y-8">
  <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
    <div class="max-w-2xl space-y-3">
      <p class="text-xs uppercase tracking-[0.28em] text-stone-500">Channels</p>
      <h1
        class="text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl"
      >
        Youtube channels in the crawl queue.
      </h1>
    </div>
  </div>

  {#if channels.ready}
    <div class="border-y border-stone-300/80">
      {#each channels.current as channel (channel.id)}
        <article
          class="grid gap-4 border-b border-stone-200/80 py-5 sm:grid-cols-[minmax(0,1.4fr)_auto_auto_auto_auto]"
        >
          <a
            class="flex min-w-0 items-center gap-4 transition hover:bg-stone-50/80"
            href={`/channel/${channel.id}`}
          >
            <Avatar alt={channel.name} size="md" src={channel.avatarUrl} />

            <div class="min-w-0">
              <h2 class="truncate text-lg font-medium text-stone-950">
                {channel.name}
              </h2>
              <p class="truncate text-sm text-stone-500">
                {channel.ytCustomUrl ?? channel.ytChannelId}
              </p>
            </div>
          </a>

          <p class="text-sm text-stone-700">
            {formatCount(channel.subscriberCount)} subs
          </p>
          <p class="text-sm text-stone-700">{channel.videoCount ?? 0} videos</p>
          <p class="text-sm text-stone-500">
            {formatDate(channel.lastYoutubeSyncedAt)}
          </p>
          <a
            class="text-sm text-stone-500 underline decoration-stone-300 underline-offset-4 hover:decoration-stone-700"
            href={channel.youtubeUrl}
            rel="noreferrer"
            target="_blank"
          >
            YouTube
          </a>
        </article>
      {/each}
    </div>
  {:else}
    <p class="text-sm text-stone-500">Loading channels...</p>
  {/if}
</section>
