<script lang="ts">
  import { getChannels } from "$lib/dashboard.remote";
  import { formatCount, formatDate } from "$lib/format";

  const channels = getChannels();
</script>

<svelte:head>
  <title>Sentinel Dashboard</title>
</svelte:head>

<section class="space-y-8">
  <div class="max-w-2xl space-y-3">
    <p class="text-xs uppercase tracking-[0.28em] text-stone-500">Channels</p>
    <h1
      class="text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl"
    >
      Youtube channels in the crawl queue.
    </h1>
  </div>

  {#if channels.ready}
    <div class="border-y border-stone-300/80">
      {#each channels.current as channel (channel.id)}
        <a
          class="grid gap-4 border-b border-stone-200/80 py-5 transition hover:bg-stone-50/80 sm:grid-cols-[minmax(0,1.4fr)_auto_auto_auto]"
          href={`/channel/${channel.id}`}
        >
          <div class="flex min-w-0 items-center gap-4">
            {#if channel.avatarUrl}
              <img
                alt={channel.name}
                class="h-12 w-12 rounded-full object-cover"
                src={channel.avatarUrl}
              />
            {/if}

            <div class="min-w-0">
              <h2 class="truncate text-lg font-medium text-stone-950">
                {channel.name}
              </h2>
              <p class="truncate text-sm text-stone-500">
                {channel.ytCustomUrl ?? channel.ytChannelId}
              </p>
            </div>
          </div>

          <p class="text-sm text-stone-700">
            {formatCount(channel.subscriberCount)} subs
          </p>
          <p class="text-sm text-stone-700">{channel.videoCount ?? 0} videos</p>
          <p class="text-sm text-stone-500">
            {formatDate(channel.lastYoutubeSyncedAt)}
          </p>
        </a>
      {/each}
    </div>
  {:else}
    <p class="text-sm text-stone-500">Loading channels...</p>
  {/if}
</section>
